const axios = require("axios");
const logger = require("#src/config/logging/winston");
const { isEmailConfigured, sendAlertEmail } = require("#src/config/email");
const { buildHealthAlertEmail } = require("#src/config/emailTemplates");

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

async function notifyDownEmail(downTransitions) {
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

async function notifyTransitions(transitions) {
	if (!transitions.length) return;

	for (const transition of transitions) {
		const text = buildTransitionMessage(transition);
		logger.info(text);
		await notifySlack(transition, text);
	}

	// Email only for DOWN — never for recovery/UP
	const downTransitions = transitions.filter((t) => t.to === "DOWN");
	await notifyDownEmail(downTransitions);
}

module.exports = { notifyTransitions };
