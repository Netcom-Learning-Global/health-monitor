const registry = require("#src/config/services.registry");
const logger = require("#src/config/logging/winston");
const { initRedis } = require("#src/config/redis");
const { checkAllServices } = require("#src/services/healthChecker");
const { saveHealthSnapshot } = require("#src/services/statusCache");
const { notifyTransitions } = require("#src/config/notifier");

let schedulerHandle = null;

async function runHealthCheck() {
	const results = await checkAllServices(registry.services, registry.retry);
	const { payload, transitions } = await saveHealthSnapshot(results);

	if (transitions.length > 0) {
		await notifyTransitions(transitions);
	}

	const upCount = Object.values(results).filter((service) => service.status === "UP").length;
	logger.info(
		`Health check complete: overall=${payload.overall} up=${upCount}/${registry.services.length}`
	);

	return payload;
}

async function startHealthScheduler() {
	initRedis();

	await runHealthCheck();

	schedulerHandle = setInterval(() => {
		runHealthCheck().catch((err) => {
			logger.error(`Scheduled health check failed: ${err.message}`);
		});
	}, registry.pollIntervalMs);

	const shutdown = () => {
		if (schedulerHandle) {
			clearInterval(schedulerHandle);
			schedulerHandle = null;
		}
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	logger.info(`Health scheduler started (interval=${registry.pollIntervalMs}ms)`);
}

module.exports = { startHealthScheduler, runHealthCheck };
