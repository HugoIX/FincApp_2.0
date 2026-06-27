const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/farms", authMiddleware, dashboardController.getFarms);
router.get("/summary", authMiddleware, dashboardController.getSummary);
router.get("/farms/:farmId/summary", authMiddleware, dashboardController.getSummary);

module.exports = router;
