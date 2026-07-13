const axios = require("axios");
const logger = require("#src/config/logging/winston");
const { isEmailConfigured, sendAlertEmail } = require("#src/config/email");
const { buildHealthAlertEmail } = require("#src/config/emailTemplates");

// Collect DOWN events across polls, then send one merged email.
const EMAIL_BATCH_WINDOW_MS = Number(
	process.env.ALERT_EMAIL_BATCH_WINDOW_MS || 30000
);

const pendingDownByServiceId = new Map();
let batchTimer = null;

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

function clearBatchTimer() {
	if (!batchTimer) return;
	clearTimeout(batchTimer);
	batchTimer = null;
}

async function flushDownEmailBatch() {
	clearBatchTimer();

	const downTransitions = Array.from(pendingDownByServiceId.values());
	pendingDownByServiceId.clear();

	if (!isEmailConfigured() || !downTransitions.length) return;

	const { subject, text, html } = buildHealthAlertEmail(downTransitions);
	const names = downTransitions.map((t) => t.serviceName).join(", ");

	try {
		await sendAlertEmail({ subject, text, html });
		logger.info(
			`Merged email alert sent for ${downTransitions.length} DOWN service(s): ${names}`
		);
	} catch (err) {
		const details = err.response?.body
			? ` — ${JSON.stringify(err.response.body)}`
			: "";
		logger.error(
			`Email notification failed for DOWN batch (${names}): ${err.message}${details}`
		);
	}
}

function scheduleDownEmailBatch() {
	// Sliding window: every new DOWN resets the wait so one-by-one stops still merge.
	clearBatchTimer();

	logger.info(
		`Email batch window armed (${EMAIL_BATCH_WINDOW_MS}ms); pending=[${Array.from(
			pendingDownByServiceId.keys()
		).join(", ")}]`
	);

	batchTimer = setTimeout(() => {
		flushDownEmailBatch().catch((err) => {
			logger.error(`Failed to flush email batch: ${err.message}`);
		});
	}, EMAIL_BATCH_WINDOW_MS);

	if (typeof batchTimer.unref === "function") {
		batchTimer.unref();
	}
}

function queueDownTransitions(downTransitions) {
	if (!isEmailConfigured() || !downTransitions.length) return;

	for (const transition of downTransitions) {
		pendingDownByServiceId.set(transition.serviceId, transition);
	}

	logger.info(
		`Queued ${downTransitions.length} DOWN alert(s); pending total=${pendingDownByServiceId.size}`
	);

	// Same poll with 2+ downs → send one merged email immediately (no wait).
	if (downTransitions.length > 1 || pendingDownByServiceId.size > 1) {
		flushDownEmailBatch().catch((err) => {
			logger.error(`Failed to flush multi-DOWN email: ${err.message}`);
		});
		return;
	}

	scheduleDownEmailBatch();
}

function clearRecoveredFromPending(upTransitions) {
	if (!upTransitions.length || !pendingDownByServiceId.size) return;

	for (const transition of upTransitions) {
		if (pendingDownByServiceId.delete(transition.serviceId)) {
			logger.info(
				`Removed ${transition.serviceName} from pending email batch (recovered before send)`
			);
		}
	}

	if (!pendingDownByServiceId.size) {
		clearBatchTimer();
		logger.info("Email batch cancelled — no remaining DOWN services");
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

	clearRecoveredFromPending(upTransitions);
	queueDownTransitions(downTransitions);
}

module.exports = { notifyTransitions };
