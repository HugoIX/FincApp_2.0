const db = require("../config/db");

exports.totalAnimals = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS total_animals
      FROM animals
    `);

    res.json(rows[0] || { total_animals: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error getting total animals" });
  }
};

exports.averageWeight = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ROUND(AVG(current_weight), 2) AS average_weight
      FROM weight_logs
    `);

    res.json(rows[0] || { average_weight: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error getting average weight" });
  }
};

exports.healthAlerts = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COALESCE(alert_level, 'low') AS alert_level, COUNT(*) AS total
      FROM health_records
      GROUP BY COALESCE(alert_level, 'low')
      ORDER BY FIELD(COALESCE(alert_level, 'low'), 'high', 'medium', 'low')
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error getting health alerts" });
  }
};

exports.animalsByType = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        CASE
          WHEN LOWER(COALESCE(breed, '')) REGEXP 'cerdo|porc|swine|marrano|puerco' THEN 'swine'
          WHEN LOWER(COALESCE(breed, '')) REGEXP 'pollo|gallina|ave|poultry' THEN 'poultry'
          ELSE 'cattle'
        END AS animal_type,
        COUNT(*) AS total
      FROM animals
      GROUP BY animal_type
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error getting animals by type" });
  }
};
