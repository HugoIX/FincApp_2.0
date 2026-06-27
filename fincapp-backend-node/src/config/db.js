require("dotenv").config();
const mysql = require("mysql2/promise");

const required = ["DB_HOST", "DB_USER", "DB_NAME"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.warn(`Missing database environment variables: ${missing.join(", ")}`);
}

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fincapp",
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

(async () => {
  try {
    const conn = await db.getConnection();
    console.log("Database connected successfully");
    conn.release();
  } catch (err) {
    console.error("Database connection error:", err.message);
  }
})();

module.exports = db;
