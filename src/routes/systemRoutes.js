const express = require("express");
const { getRedirectUrl } = require("#src/config/redirect");
const { runHealthCheck } = require("#src/services/scheduler");
const {
	getLatestHealth,
	getDownServices,
	isSystemReady,
} = require("#src/services/statusCache");

const router = express.Router();

function buildUnavailableResponse(cached, downServices) {
	return {
		success: false,
		status: 503,
		message_code: "SERVICE_UNAVAILABLE",
		data: {
			maintenance: true,
			ready: false,
			redirect: true,
			redirectUrl: getRedirectUrl(),
			unavailableServices: downServices,
			updatedAt: cached?.updatedAt || null,
		},
	};
}

router.get("/health", async (_req, res) => {
	const cached = await getLatestHealth();

	if (!cached) {
		return res.status(503).json({
			success: false,
			status: 503,
			message_code: "HEALTH_CACHE_EMPTY",
			data: {
				overall: "UNKNOWN",
				redirectUrl: getRedirectUrl(),
				services: {},
			},
		});
	}

	const statusCode = cached.overall === "UP" ? 200 : 503;
	return res.status(statusCode).json({
		success: cached.overall === "UP",
		status: statusCode,
		message_code: cached.overall === "UP" ? "SUCCESS" : "SERVICE_UNAVAILABLE",
		data: {
			...cached,
			redirectUrl: cached.overall === "UP" ? null : getRedirectUrl(),
		},
	});
});

router.get("/readiness", async (_req, res) => {
	const cached = await getLatestHealth();

	if (!isSystemReady(cached)) {
		const downServices = cached ? getDownServices(cached) : [];
		return res.status(503).json(buildUnavailableResponse(cached, downServices));
	}

	return res.status(200).json({
		success: true,
		status: 200,
		message_code: "SUCCESS",
		data: {
			ready: true,
			redirect: false,
			redirectUrl: null,
			overall: cached.overall,
			updatedAt: cached.updatedAt,
		},
	});
});

router.get("/gate", async (req, res) => {
	const cached = await getLatestHealth();
	const returnUrl = typeof req.query.returnUrl === "string" ? req.query.returnUrl : null;

	if (!isSystemReady(cached)) {
		const redirectTarget = getRedirectUrl();
		if (req.query.format === "json") {
			return res.status(503).json(buildUnavailableResponse(cached, getDownServices(cached)));
		}
		return res.redirect(302, redirectTarget);
	}

	if (returnUrl && req.query.format !== "json") {
		return res.redirect(302, returnUrl);
	}

	return res.status(200).json({
		success: true,
		status: 200,
		message_code: "SUCCESS",
		data: {
			ready: true,
			redirect: false,
			stay: true,
			updatedAt: cached.updatedAt,
		},
	});
});

router.get("/services", async (_req, res) => {
	const cached = await getLatestHealth();
	return res.status(200).json({
		success: true,
		status: 200,
		message_code: "SUCCESS",
		data: {
			redirectUrl: getRedirectUrl(),
			cached: cached || null,
		},
	});
});

router.post("/check-now", async (_req, res) => {
	const payload = await runHealthCheck();
	const downServices = getDownServices(payload);
	const statusCode = payload.overall === "UP" ? 200 : 503;

	return res.status(statusCode).json({
		success: payload.overall === "UP",
		status: statusCode,
		message_code: payload.overall === "UP" ? "SUCCESS" : "SERVICE_UNAVAILABLE",
		data: {
			...payload,
			redirectUrl: payload.overall === "UP" ? null : getRedirectUrl(),
			unavailableServices: downServices,
		},
	});
});

module.exports = router;
