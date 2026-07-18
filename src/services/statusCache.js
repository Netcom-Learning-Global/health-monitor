const registry = require("#src/config/services.registry");
const {
	getCachedHealth,
	setCachedHealth,
	REDIS_HEALTH_KEY,
} = require("#src/config/redis");

function computeOverall(services, current) {
	const allUp = services.every((service) => current[service.id]?.status === "UP");
	return allUp ? "UP" : "DOWN";
}

function detectTransitions(previous, current, services) {
	const transitions = [];

	for (const service of services) {
		const prevStatus = previous?.services?.[service.id]?.status || "UNKNOWN";
		const currStatus = current[service.id]?.status || "DOWN";

		if (prevStatus !== "UNKNOWN" && prevStatus !== currStatus) {
			transitions.push({
				serviceId: service.id,
				serviceName: service.name,
				from: prevStatus,
				to: currStatus,
				critical: service.critical,
				at: new Date().toISOString(),
				url: current[service.id]?.url || null,
				error: current[service.id]?.error || null,
				httpStatus: current[service.id]?.httpStatus || null,
			});
		}
	}

	return transitions;
}

async function saveHealthSnapshot(current) {
	const previous = await getCachedHealth(REDIS_HEALTH_KEY);
	const transitions = detectTransitions(previous, current, registry.services);

	const payload = {
		overall: computeOverall(registry.services, current),
		services: current,
		updatedAt: new Date().toISOString(),
	};

	await setCachedHealth(REDIS_HEALTH_KEY, payload, registry.cacheTtlSeconds);

	return { payload, transitions, previous };
}

async function getLatestHealth() {
	return getCachedHealth(REDIS_HEALTH_KEY);
}

function getDownServices(payload) {
	if (!payload?.services) return [];

	return registry.services
		.filter((service) => payload.services[service.id]?.status !== "UP")
		.map((service) => ({
			id: service.id,
			name: service.name,
			status: payload.services[service.id]?.status || "DOWN",
			error: payload.services[service.id]?.error || null,
			url: payload.services[service.id]?.url || null,
		}));
}

function isSystemReady(payload) {
	if (!payload) return false;
	return computeOverall(registry.services, payload.services || {}) === "UP";
}

module.exports = {
	saveHealthSnapshot,
	getLatestHealth,
	getDownServices,
	computeOverall,
	isSystemReady,
};
