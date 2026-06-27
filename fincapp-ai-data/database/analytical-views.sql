-- ============================================================
-- FincApp | Analytical Views
-- Script   : analytical-views.sql
-- Author   : José Miguel (US-01-JOSEMIGUEL, US-11-JOSEMIGUEL)
-- Purpose  : Pre-aggregated analytical views for dashboard KPIs,
--            AI recommendation flow and operational monitoring.
-- Run in   : Supabase SQL Editor — after schema.sql
-- ============================================================


-- ------------------------------------------------------------
-- VIEW 1: vw_active_modules_summary
-- Summarizes the number of active production modules per farm
-- and production type. Consumed by dashboard and n8n workflows.
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW vw_active_modules_summary AS
    SELECT
        f.owner_id,
        pm.farm_id,
        f.name              AS farm_name,
        pm.type             AS production_type,
        COUNT(*)            AS active_module_count
    FROM production_modules pm
    INNER JOIN farms f
        ON f.id = pm.farm_id
    WHERE pm.is_active = TRUE
    GROUP BY
        f.owner_id,
        pm.farm_id,
        f.name,
        pm.type;


-- ------------------------------------------------------------
-- VIEW 2: vw_farm_operational_status
-- Provides the operational status of each farm based on its
-- active production modules. Used for farm health monitoring.
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW vw_farm_operational_status AS
    SELECT
        f.id                AS farm_id,
        f.name              AS farm_name,
        f.owner_id,
        f.location,
        COUNT(
            CASE WHEN pm.is_active = TRUE THEN 1 END
        )                   AS active_module_count,
        COUNT(
            CASE WHEN pm.is_active = TRUE THEN 1 END
        ) > 0               AS is_operational
    FROM farms f
    LEFT JOIN production_modules pm
        ON pm.farm_id = f.id
    GROUP BY
        f.id,
        f.name,
        f.owner_id,
        f.location;


-- ------------------------------------------------------------
-- VIEW 3: view_farm_inventory_analytics
-- Pre-calculates headcount and status distribution across
-- different farms and production lines. Consumed by dashboard
-- inventory panel and AI recommendation flow.
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW view_farm_inventory_analytics AS
    SELECT
        f.id                AS farm_id,
        f.name              AS farm_name,
        a.type              AS production_line,
        a.status            AS health_status,
        COUNT(a.id)         AS total_headcount,
        MAX(a.created_at)   AS last_inventory_update
    FROM farms f
    LEFT JOIN animals a
        ON f.id = a.farm_id
    GROUP BY
        f.id,
        f.name,
        a.type,
        a.status;


-- ------------------------------------------------------------
-- VIEW 4: view_animal_weight_performance
-- Extracts time-series weight metrics per animal. Returns
-- lifetime average, maximum recorded weight and total weighing
-- sessions. Consumed by dashboard growth tracking panel.
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW view_animal_weight_performance AS
    SELECT
        a.farm_id,
        w.animal_id,
        a.identification_tag,
        a.type                      AS production_line,
        ROUND(AVG(w.weight_kg), 2)  AS lifetime_average_weight,
        MAX(w.weight_kg)            AS maximum_recorded_weight,
        COUNT(w.id)                 AS total_weighing_sessions
    FROM animals a
    JOIN weight_logs w
        ON a.id = w.animal_id
    GROUP BY
        a.farm_id,
        w.animal_id,
        a.identification_tag,
        a.type;


-- ------------------------------------------------------------
-- VIEW 5: view_health_alert_summary
-- Returns health record counts grouped by farm and animal
-- status (severity). Consumed by dashboard alert panel and
-- Juan Pablo's n8n LLM automation pipeline.
--
-- Severity mapping:
--   healthy    → no alert
--   sick       → active alert
--   quarantine → critical alert
--   sold       → informational
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW view_health_alert_summary AS
    SELECT
        f.id                AS farm_id,
        f.name              AS farm_name,
        f.owner_id,
        a.status            AS severity,
        COUNT(hr.id)        AS total_health_records,
        MAX(hr.recorded_at) AS last_recorded_at
    FROM health_records hr
    INNER JOIN animals a
        ON a.id = hr.animal_id
    INNER JOIN farms f
        ON f.id = a.farm_id
    GROUP BY
        f.id,
        f.name,
        f.owner_id,
        a.status;


-- ============================================================
-- Next step: validate views with seed data (Hugo - sub-task 4)
-- ============================================================