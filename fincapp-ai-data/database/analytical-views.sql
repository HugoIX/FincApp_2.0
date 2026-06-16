-- Summarizes the number of active production modules per farm and production type.
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


-- Provides the operational status of each farm based on its active production modules.
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