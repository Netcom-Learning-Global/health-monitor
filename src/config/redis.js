const Redis = require("ioredis");
const retryStrategy = require("node-redis-retry-strategy");
const logger = require("#src/config/logging/winston");

let redisClient = null;
let memoryStore = new Map();

function createRedisClient() {
	if (!process.env.REDIS_HOST) {
		logger.info("REDIS_HOST not set — using in-memory health cache");
		return null;
	}

	const client = new Redis({
		host: process.env.REDIS_HOST,
		port: Number(process.env.REDIS_PORT || 6379),
		username: process.env.REDIS_USERNAME || undefined,
		password: process.env.REDIS_PASSWORD || undefined,
		retryStrategy: retryStrategy({
			allow_to_start_without_connection: true,
			wait_time: 1000,
		}),
	});

	client.on("error", (err) => logger.error(`Redis error: ${err.message}`));
	client.on("ready", () => logger.info("Redis connected for health cache"));

	return client;
}

async function getCachedHealth(key) {
	if (redisClient) {
		const raw = await redisClient.get(key);
		return raw ? JSON.parse(raw) : null;
	}

	const entry = memoryStore.get(key);
	if (!entry) return null;
	if (entry.expiresAt < Date.now()) {
		memoryStore.delete(key);
		return null;
	}
	return entry.value;
}

async function setCachedHealth(key, value, ttlSeconds) {
	if (redisClient) {
		await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
		return;
	}

	memoryStore.set(key, {
		value,
		expiresAt: Date.now() + ttlSeconds * 1000,
	});
}

function initRedis() {
	redisClient = createRedisClient();
	return redisClient;
}

module.exports = {
	initRedis,
	getCachedHealth,
	setCachedHealth,
	REDIS_HEALTH_KEY: "proctor:system:health",
};
