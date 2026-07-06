const express = require("express");
const router = express.Router();

router.get("/healthz", (_req, res) => {
	res.status(200).send("OK");
});

router.get("/live", (_req, res) => {
	res.status(200).json({
		status: "ok",
		service: "proctor-health-monitor",
	});
});

module.exports = router;
