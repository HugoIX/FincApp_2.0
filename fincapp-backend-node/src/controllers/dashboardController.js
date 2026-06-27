const db = require("../config/db");

function normalizeFarmId(value) {
  if (!value || value === "all") return "all";
  return String(value).trim();
}

function getFarmWhereClause(farmId) {
  if (!farmId || farmId === "all") {
    return { sql: "", params: [] };
  }

  return {
    sql: " WHERE COALESCE(u.farm_name, 'Default Farm') = ? ",
    params: [farmId]
  };
}

function typeCaseSql(alias = "a") {
  return `
    CASE
      WHEN LOWER(COALESCE(${alias}.breed, '')) REGEXP 'cerdo|porc|swine|marrano|puerco' THEN 'swine'
      WHEN LOWER(COALESCE(${alias}.breed, '')) REGEXP 'pollo|gallina|ave|poultry' THEN 'poultry'
      ELSE 'cattle'
    END
  `;
}

exports.getFarms = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT COALESCE(farm_name, 'Default Farm') AS id,
             COALESCE(farm_name, 'Default Farm') AS name
      FROM users
      ORDER BY name
    `);

    const farms = rows.length > 0
      ? rows
      : [{ id: "Default Farm", name: "Default Farm" }];

    res.json([
      { id: "all", name: "All farms" },
      ...farms
    ]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error getting farms" });
  }
};

exports.getSummary = async (req, res) => {
  const farmId = normalizeFarmId(req.query.farm_id || req.params.farmId);
  const filter = getFarmWhereClause(farmId);

  try {
    const [totalRows] = await db.query(`
      SELECT COUNT(*) AS total_animals
      FROM animals a
      LEFT JOIN users u ON u.id = a.user_id
      ${filter.sql}
    `, filter.params);

    const [typeRows] = await db.query(`
      SELECT ${typeCaseSql("a")} AS animal_type, COUNT(*) AS total
      FROM animals a
      LEFT JOIN users u ON u.id = a.user_id
      ${filter.sql}
      GROUP BY animal_type
    `, filter.params);

    const [weightRows] = await db.query(`
      SELECT ROUND(AVG(w.current_weight), 2) AS average_weight
      FROM weight_logs w
      LEFT JOIN animals a ON a.id = w.animal_id
      LEFT JOIN users u ON u.id = COALESCE(w.user_id, a.user_id)
      ${filter.sql}
    `, filter.params);

    const [healthRows] = await db.query(`
      SELECT
        h.id,
        h.animal_id,
        a.tag_number,
        COALESCE(h.alert_level, 'low') AS severity,
        COALESCE(h.ai_diagnosis, h.medication_name, 'Health observation') AS description,
        h.event_date
      FROM health_records h
      LEFT JOIN animals a ON a.id = h.animal_id
      LEFT JOIN users u ON u.id = COALESCE(h.user_id, a.user_id)
      ${filter.sql}
      ORDER BY FIELD(COALESCE(h.alert_level, 'low'), 'high', 'medium', 'low'), h.event_date DESC
      LIMIT 8
    `, filter.params);

    const [activityRows] = await db.query(`
      SELECT
        fe.id,
        fe.event_type,
        fe.description,
        fe.created_at,
        a.tag_number
      FROM farm_events fe
      LEFT JOIN animals a ON a.id = fe.animal_id
      LEFT JOIN users u ON u.id = COALESCE(fe.user_id, a.user_id)
      ${filter.sql}
      ORDER BY fe.created_at DESC
      LIMIT 8
    `, filter.params);

    const [trendRows] = await db.query(`
      SELECT
        DATE_FORMAT(w.weighing_date, '%b %d') AS label,
        ROUND(AVG(w.current_weight), 2) AS value
      FROM weight_logs w
      LEFT JOIN animals a ON a.id = w.animal_id
      LEFT JOIN users u ON u.id = COALESCE(w.user_id, a.user_id)
      ${filter.sql}
      GROUP BY DATE(w.weighing_date), label
      ORDER BY DATE(w.weighing_date) DESC
      LIMIT 7
    `, filter.params);

    const totalAnimals = Number(totalRows[0]?.total_animals || 0);
    const averageWeight = Number(weightRows[0]?.average_weight || 0);
    const healthAlerts = healthRows.filter((row) => ["high", "medium"].includes(String(row.severity).toLowerCase())).length;

    res.json({
      farm_id: farmId,
      total_animals: totalAnimals,
      animals_by_type: typeRows,
      average_weight: averageWeight,
      health_alerts_count: healthAlerts,
      health_alerts: healthRows,
      recent_activity: activityRows,
      weight_trend: trendRows.reverse(),
      pending_sync: 0,
      empty: totalAnimals === 0 && healthRows.length === 0 && activityRows.length === 0,
      last_sync: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error getting dashboard summary" });
  }
};
