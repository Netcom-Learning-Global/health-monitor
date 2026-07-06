const axios = require("axios");
const logger = require("#src/config/logging/winston");

async function notifyTransitions(transitions) {
	if (!transitions.length) return;

	for (const transition of transitions) {
		const text = `[Proctor Health] ${transition.serviceName} changed ${transition.from} -> ${transition.to} at ${transition.at}`;
		logger.info(text);

		if (process.env.SLACK_WEBHOOK_URL) {
			const emoji = transition.to === "DOWN" ? ":red_circle:" : ":large_green_circle:";
			try {
				await axios.post(process.env.SLACK_WEBHOOK_URL, {
					text: `${emoji} ${text}`,
				});
			} catch (err) {
				logger.error(`Slack notification failed: ${err.message}`);
			}
		}
	}
}

module.exports = { notifyTransitions };
