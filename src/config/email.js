const sgMail = require("@sendgrid/mail");
const logger = require("#src/config/logging/winston");

let apiKeyConfigured = false;

function isEmailConfigured() {
	return Boolean(
		process.env.ALERT_EMAIL_ENABLED === "true" &&
			process.env.SENDGRID_API_KEY &&
			process.env.EMAIL_FROM_ADDRESS &&
			process.env.ALERT_EMAIL_TO
	);
}

function ensureSendGrid() {
	if (!isEmailConfigured()) return false;
	if (!apiKeyConfigured) {
		sgMail.setApiKey(process.env.SENDGRID_API_KEY);
		apiKeyConfigured = true;
	}
	return true;
}

function parseRecipientList(value) {
	return String(value || "")
		.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
}

function getAlertRecipients(serviceId) {
	const perServiceKey = `ALERT_EMAIL_${String(serviceId || "")
		.replace(/-/g, "_")
		.toUpperCase()}`;
	const perService = process.env[perServiceKey];

	if (perService) {
		return parseRecipientList(perService);
	}

	return parseRecipientList(process.env.ALERT_EMAIL_TO);
}

function getFromAddress() {
	const address = process.env.EMAIL_FROM_ADDRESS;
	const name = process.env.EMAIL_FROM_NAME;

	if (name) {
		return `${name} <${address}>`;
	}

	return address;
}

async function sendAlertEmail({ subject, text, html, serviceId }) {
	if (!ensureSendGrid()) return false;

	// Merged multi-service alerts always use ALERT_EMAIL_TO.
	// Per-service overrides only apply when a single serviceId is provided.
	const to = serviceId
		? getAlertRecipients(serviceId)
		: parseRecipientList(process.env.ALERT_EMAIL_TO);

	if (!to.length) {
		logger.warn("ALERT_EMAIL_TO is empty — skipping email alert");
		return false;
	}

	await sgMail.send({
		to,
		from: getFromAddress(),
		subject,
		text,
		html,
	});

	return true;
}

module.exports = {
	isEmailConfigured,
	sendAlertEmail,
	parseRecipientList,
};
