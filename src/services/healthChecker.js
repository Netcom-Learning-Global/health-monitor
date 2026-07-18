const axios = require("axios");

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveServiceBaseUrl(service) {
	let base = service.url.replace(/\/$/, "");

	if (service.id === "communication-service" && base.endsWith("/communication")) {
		base = base.slice(0, -"/communication".length);
	}

	return base;
}

function buildHealthUrl(service) {
	return `${resolveServiceBaseUrl(service)}${service.path}`;
}

function isHealthyResponse(response) {
	if (response.status < 200 || response.status >= 300) {
		return false;
	}

	const body = response.data;
	if (body && typeof body === "object") {
		if (body.status === "DOWN" || body.status === "degraded") {
			return false;
		}
		if (body.success === false) {
			return false;
		}
	}

	return true;
}

async function checkServiceWithRetry(service, retryConfig) {
	const { attempts, timeoutMs, backoffMs } = retryConfig;
	const startedAt = Date.now();
	const healthUrl = buildHealthUrl(service);
	let lastError = null;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const response = await axios.get(healthUrl, {
				timeout: timeoutMs,
				validateStatus: () => true,
			});

			if (isHealthyResponse(response)) {
				return {
					id: service.id,
					name: service.name,
					status: "UP",
					url: healthUrl,
					httpStatus: response.status,
					latencyMs: Date.now() - startedAt,
					checkedAt: new Date().toISOString(),
					attempt,
					critical: service.critical,
				};
			}

			const bodyStatus = response.data?.status;
			lastError = new Error(
				bodyStatus ? `Service status ${bodyStatus}` : `HTTP ${response.status}`
			);
		} catch (err) {
			lastError = new Error(
				err.code
					? `${err.code}: ${err.message}`
					: err.message || "unknown error"
			);
		}

		if (attempt < attempts) {
			await sleep(backoffMs * attempt);
		}
	}

	return {
		id: service.id,
		name: service.name,
		status: "DOWN",
		url: healthUrl,
		error: lastError?.message || "unknown error",
		latencyMs: Date.now() - startedAt,
		checkedAt: new Date().toISOString(),
		attempt: attempts,
		critical: service.critical,
	};
}

async function checkAllServices(services, retryConfig) {
	const results = await Promise.all(
		services.map((service) => checkServiceWithRetry(service, retryConfig))
	);
	return Object.fromEntries(results.map((result) => [result.id, result]));
}

module.exports = {
	checkServiceWithRetry,
	checkAllServices,
	buildHealthUrl,
};
