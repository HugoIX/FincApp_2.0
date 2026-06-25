-- ============================================================
-- FincApp | Animal Inventory RLS Policies & Composite Index
-- Script   : us02-rls-and-indexes.sql
-- Author   : José Miguel (US-02-JOSEMIGUEL)
-- Depends  : schema.sql must be executed first
-- Purpose  : Enforce row-level tenant isolation on animal
--            inventory tables and add composite index for
--            analytical query performance under 200ms.
-- Run in   : Supabase SQL Editor — after schema.sql
-- ============================================================


-- ------------------------------------------------------------
-- COMPOSITE INDEX
-- Covers queries that filter by farm_id AND animal id together.
-- Pattern: "get records for animal X belonging to farm Y"
-- Without this, PostgreSQL crosses two filters without support.
-- ------------------------------------------------------------

CREATE INDEX idx_animals_farm_animal ON animals(farm_id, id);


-- ------------------------------------------------------------
-- ENABLE RLS ON NEW TABLES
-- Without this, policies exist but are never enforced.
-- ------------------------------------------------------------

ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_telemetry_logs ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- RLS POLICIES
-- All policies use auth.uid() to identify the authenticated
-- tenant and restrict visibility to their own data only.
-- ------------------------------------------------------------

CREATE POLICY "owner_sees_own_animals"
ON animals
FOR SELECT
USING (
    farm_id IN (
        SELECT id FROM farms
        WHERE owner_id = auth.uid()
    )
);

CREATE POLICY "owner_sees_own_weight_logs"
ON weight_logs
FOR SELECT
USING (
    animal_id IN (
        SELECT a.id FROM animals a
        JOIN farms f ON f.id = a.farm_id
        WHERE f.owner_id = auth.uid()
    )
);

CREATE POLICY "owner_sees_own_health_records"
ON health_records
FOR SELECT
USING (
    animal_id IN (
        SELECT a.id FROM animals a
        JOIN farms f ON f.id = a.farm_id
        WHERE f.owner_id = auth.uid()
    )
);

CREATE POLICY "owner_sees_own_sync_logs"
ON sync_telemetry_logs
FOR SELECT
USING (
    farm_id IN (
        SELECT id FROM farms
        WHERE owner_id = auth.uid()
    )
);

-- ============================================================
-- Next step: open PR toward develop and assign Hugo as reviewer
-- ============================================================