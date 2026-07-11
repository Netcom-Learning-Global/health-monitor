const services = [
	{
		id: "auth-service",
		name: "Auth Service",
		url: process.env.AUTH_SERVICE_URL || "http://localhost:3000",
		path: "/health/healthz",
		critical: true,
	},
	{
		id: "communication-service",
		name: "Communication Service",
		url: process.env.COMMUNICATION_SERVICE_URL || "http://localhost:3001",
		path: "/health/healthz",
		critical: true,
	},
	{
		id: "admin-management-apis",
		name: "Admin Management APIs",
		url: process.env.ADMIN_MANAGEMENT_URL || "http://localhost:3003",
		path: "/health/healthz",
		critical: true,
	},
	{
		id: "proctoring-backend-apis",
		name: "Proctoring Backend APIs",
		url: process.env.PROCTORING_BACKEND_URL || "http://localhost:3030",
		path: "/health/healthz",
		critical: true,
	},
	{
		id: "rabbitmq-consumer",
		name: "RabbitMQ Consumer",
		url: process.env.RABBITMQ_CONSUMER_URL || "http://localhost:5000",
		path: "/health/healthz",
		critical: true,
	},
	{
		id: "io-handler",
		name: "Proctoring IO Handler",
		url: process.env.IO_HANDLER_URL || "http://localhost:3010",
		path: "/health/healthz",
		critical: true,
	},
	{
		id: "webrtc-server",
		name: "WebRTC Server",
		url: process.env.WEBRTC_SERVER_URL || "http://localhost:4000",
		path: "/health/healthz",
		critical: true,
	},
	{
		id: "admin-portal",
		name: "Admin Portal",
		url: process.env.ADMIN_PORTAL_URL || "http://localhost:4012",
		path: "/health/healthz",
		critical: true,
	},
	{
		id: "candidate-portal",
		name: "Candidate Portal",
		url: process.env.CANDIDATE_PORTAL_URL || "http://localhost:4005",
		path: "/health/healthz",
		critical: true,
	},
];

module.exports = {
	services,
	pollIntervalMs: Number(process.env.HEALTH_POLL_INTERVAL_MS || 30000),
	cacheTtlSeconds: Number(process.env.HEALTH_CACHE_TTL_SECONDS || 120),
	retry: {
		attempts: Number(process.env.HEALTH_RETRY_ATTEMPTS || 3),
		timeoutMs: Number(process.env.HEALTH_REQUEST_TIMEOUT_MS || 5000),
		backoffMs: Number(process.env.HEALTH_RETRY_BACKOFF_MS || 1000),
	},
};
