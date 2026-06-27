const db = require('../config/db');

const User = {
  create: async (user) => {
    const sql = `
      INSERT INTO users
      (full_name, email, password, phone, farm_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, user);
    return result;
  },

  findByEmail: async (email) => {
    const sql = `
      SELECT * FROM users WHERE email = ?
    `;

    const [rows] = await db.query(sql, [email]);
    return rows;
  },

  findById: async (id) => {
    const sql = `
      SELECT id, full_name, email, phone, farm_name, role, created_at
      FROM users
      WHERE id = ?
    `;

    const [rows] = await db.query(sql, [id]);
    return rows;
  },

  findAll: async () => {
    const sql = `
      SELECT id, full_name, email, phone, farm_name, role, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql);
    return rows;
  }
};

module.exports = User;
