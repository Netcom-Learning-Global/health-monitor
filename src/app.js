const express = require("express");
const helmet = require("helmet");
const homeRoutes = require("#src/routes/homeRoutes");
const systemRoutes = require("#src/routes/systemRoutes");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (allowedOrigins.includes("*")) {
		res.header("Access-Control-Allow-Origin", "*");
	} else if (origin && allowedOrigins.includes(origin)) {
		res.header("Access-Control-Allow-Origin", origin);
	}
	res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
	if (req.method === "OPTIONS") {
		return res.sendStatus(204);
	}
	return next();
});

app.use(express.json());
app.use("/", homeRoutes);
app.use("/system", helmet(), systemRoutes);

app.use((req, res) => {
	res.status(404).json({
		error: true,
		status: 404,
		message_code: "ERR_NOT_FOUND",
	});
});

app.use((err, req, res, next) => {
	res.status(500).json({
		error: true,
		status: 500,
		message_code: "ERR_INTERNAL_SERVER",
		details: err.message,
	});
});

module.exports = app;
