require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // academic/demo mode: keep permissive to avoid blocking local demo
  },
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const animalRoutes = require("./routes/animalRoutes");
const weightRoutes = require("./routes/weightRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const syncRoutes = require("./routes/syncRoutes");
const reportRoutes = require("./routes/reportRoutes");
const healthRoutes = require("./routes/healthRoutes");
const farmEventsRoutes = require("./routes/farmEventsRoutes");
const vaccineRoutes = require("./routes/vaccineRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "FincApp 2.0 legacy Node API",
    message: "Backend running"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/users", userRoutes); // frontend-friendly alias

app.use("/api/animals", animalRoutes);
app.use("/api/livestock", animalRoutes); // old frontend alias

app.use("/api/weights", weightRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use("/api", syncRoutes);
app.use("/api", reportRoutes);

app.use("/api/health-records", healthRoutes);
app.use("/api/farm-events", farmEventsRoutes);
app.use("/api/activities", farmEventsRoutes); // old frontend alias
app.use("/api/vaccines", vaccineRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl
  });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled backend error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`FincApp backend running on port ${PORT}`);
});
