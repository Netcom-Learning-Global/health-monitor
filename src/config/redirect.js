const DEFAULT_REDIRECT_URL = "https://aicert.lms.com";

function getRedirectUrl() {
	const configured = process.env.MAINTENANCE_PORTAL_URL || process.env.FALLBACK_REDIRECT_URL;
	const url = (configured || DEFAULT_REDIRECT_URL).trim();
	return url.startsWith("http") ? url : `https://${url}`;
}

module.exports = { getRedirectUrl, DEFAULT_REDIRECT_URL };
