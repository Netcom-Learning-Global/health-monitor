const axios = require("axios");
const logger = require("#src/config/logging/winston");
const { isEmailConfigured, sendAlertEmail } = require("#src/config/email");
const { buildHealthAlertEmail } = require("#src/config/emailTemplates");

// Collect DOWN / UP events across polls, then send one merged email per status.
const EMAIL_BATCH_WINDOW_MS = Number(
	process.env.ALERT_EMAIL_BATCH_WINDOW_MS || 30000
);

const pendingDownByServiceId = new Map();
const pendingUpByServiceId = new Map();
let downBatchTimer = null;
let upBatchTimer = null;

function buildTransitionMessage(transition) {
	return `[Proctor Health] ${transition.serviceName} changed ${transition.from} -> ${transition.to} at ${transition.at}`;
}

async function notifySlack(transition, text) {
	if (!process.env.SLACK_WEBHOOK_URL) return;

	const emoji = transition.to === "DOWN" ? ":red_circle:" : ":large_green_circle:";

	try {
		await axios.post(process.env.SLACK_WEBHOOK_URL, {
			text: `${emoji} ${text}`,
		});
	} catch (err) {
		logger.error(`Slack notification failed: ${err.message}`);
	}
}

function clearDownBatchTimer() {
	if (!downBatchTimer) return;
	clearTimeout(downBatchTimer);
	downBatchTimer = null;
}

function clearUpBatchTimer() {
	if (!upBatchTimer) return;
	clearTimeout(upBatchTimer);
	upBatchTimer = null;
}

async function flushPendingEmail(pendingMap, clearTimerFn, logLabel) {
	clearTimerFn();

	const transitions = Array.from(pendingMap.values());
	pendingMap.clear();

	if (!isEmailConfigured() || !transitions.length) return;

	const { subject, text, html } = buildHealthAlertEmail(transitions);
	const names = transitions.map((t) => t.serviceName).join(", ");

	try {
		await sendAlertEmail({ subject, text, html });
		logger.info(
			`Merged email alert sent for ${transitions.length} ${logLabel} service(s): ${names}`
		);
	} catch (err) {
		const details = err.response?.body
			? ` — ${JSON.stringify(err.response.body)}`
			: "";
		logger.error(
			`Email notification failed for ${logLabel} batch (${names}): ${err.message}${details}`
		);
	}
}

function flushDownEmailBatch() {
	return flushPendingEmail(pendingDownByServiceId, clearDownBatchTimer, "DOWN");
}

function flushUpEmailBatch() {
	return flushPendingEmail(pendingUpByServiceId, clearUpBatchTimer, "UP");
}

function scheduleEmailBatch(pendingMap, clearTimerFn, setTimerFn, flushFn, logLabel) {
	// Sliding window: every new event resets the wait so one-by-one changes still merge.
	clearTimerFn();

	logger.info(
		`Email ${logLabel} batch window armed (${EMAIL_BATCH_WINDOW_MS}ms); pending=[${Array.from(
			pendingMap.keys()
		).join(", ")}]`
	);

	const timer = setTimeout(() => {
		flushFn().catch((err) => {
			logger.error(`Failed to flush ${logLabel} email batch: ${err.message}`);
		});
	}, EMAIL_BATCH_WINDOW_MS);

	if (typeof timer.unref === "function") {
		timer.unref();
	}

	setTimerFn(timer);
}

function scheduleDownEmailBatch() {
	scheduleEmailBatch(
		pendingDownByServiceId,
		clearDownBatchTimer,
		(timer) => {
			downBatchTimer = timer;
		},
		flushDownEmailBatch,
		"DOWN"
	);
}

function scheduleUpEmailBatch() {
	scheduleEmailBatch(
		pendingUpByServiceId,
		clearUpBatchTimer,
		(timer) => {
			upBatchTimer = timer;
		},
		flushUpEmailBatch,
		"UP"
	);
}

function queueTransitions(pendingMap, transitions, flushFn, scheduleFn, logLabel) {
	if (!isEmailConfigured() || !transitions.length) return;

	for (const transition of transitions) {
		pendingMap.set(transition.serviceId, transition);
	}

	logger.info(
		`Queued ${transitions.length} ${logLabel} alert(s); pending total=${pendingMap.size}`
	);

	// Same poll with 2+ events → send one merged email immediately (no wait).
	if (transitions.length > 1 || pendingMap.size > 1) {
		flushFn().catch((err) => {
			logger.error(`Failed to flush multi-${logLabel} email: ${err.message}`);
		});
		return;
	}

	scheduleFn();
}

function queueDownTransitions(downTransitions) {
	queueTransitions(
		pendingDownByServiceId,
		downTransitions,
		flushDownEmailBatch,
		scheduleDownEmailBatch,
		"DOWN"
	);
}

function queueUpTransitions(upTransitions) {
	queueTransitions(
		pendingUpByServiceId,
		upTransitions,
		flushUpEmailBatch,
		scheduleUpEmailBatch,
		"UP"
	);
}

function clearRecoveredFromPending(upTransitions) {
	const recoveredBeforeDownAlert = new Set();
	if (!upTransitions.length || !pendingDownByServiceId.size) {
		return recoveredBeforeDownAlert;
	}

	for (const transition of upTransitions) {
		if (pendingDownByServiceId.delete(transition.serviceId)) {
			recoveredBeforeDownAlert.add(transition.serviceId);
			logger.info(
				`Removed ${transition.serviceName} from pending DOWN email batch (recovered before send)`
			);
		}
	}

	if (!pendingDownByServiceId.size) {
		clearDownBatchTimer();
		logger.info("DOWN email batch cancelled — no remaining DOWN services");
	}

	return recoveredBeforeDownAlert;
}

function clearFailedFromPendingUp(downTransitions) {
	if (!downTransitions.length || !pendingUpByServiceId.size) return;

	for (const transition of downTransitions) {
		if (pendingUpByServiceId.delete(transition.serviceId)) {
			logger.info(
				`Removed ${transition.serviceName} from pending UP email batch (went DOWN before send)`
			);
		}
	}

	if (!pendingUpByServiceId.size) {
		clearUpBatchTimer();
		logger.info("UP email batch cancelled — no remaining recovered services");
	}
}

async function notifyTransitions(transitions) {
	if (!transitions.length) return;

	for (const transition of transitions) {
		const text = buildTransitionMessage(transition);
		logger.info(text);
		await notifySlack(transition, text);
	}

	const downTransitions = transitions.filter((t) => t.to === "DOWN");
	const upTransitions = transitions.filter((t) => t.to === "UP");

	const recoveredBeforeDownAlert = clearRecoveredFromPending(upTransitions);
	clearFailedFromPendingUp(downTransitions);
	queueDownTransitions(downTransitions);

	const upToNotify = upTransitions.filter(
		(t) => !recoveredBeforeDownAlert.has(t.serviceId)
	);
	queueUpTransitions(upToNotify);
}

module.exports = { notifyTransitions };
