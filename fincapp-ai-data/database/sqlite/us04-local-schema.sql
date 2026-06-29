-- ============================================================
-- FincApp | Local SQLite Schema for Edge NLP Validation
-- Script   : us04-local-schema.sql
-- Author   : José Miguel (US-04-JOSEMIGUEL)
-- Purpose  : Offline-first local schema for Android edge device.
--            Supports NLP tag validation and offline data capture
--            before cloud sync via Sergio's C# backend.
-- ============================================================


-- ------------------------------------------------------------
-- TABLE 1: animals
-- Local copy of the animal registry per farm.
-- Primary lookup target for the NLP engine when it extracts
-- an identification_tag from voice input.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS animals (
    -- Local integer ID for SQLite performance.
    -- cloud_id stores the Supabase UUID for sync reconciliation.
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_id            TEXT,

    farm_cloud_id       TEXT NOT NULL,

    -- TEXT replaces production_type ENUM from PostgreSQL.
    -- CHECK enforces the same constraint at the SQLite level.
    type                TEXT NOT NULL
                        CHECK(type IN ('cattle', 'swine', 'poultry')),

    -- Primary NLP lookup target (Rule 1 from Hugo's dictionary).
    -- COLLATE NOCASE: "405B" matches "405b" — case-insensitive.
    identification_tag  TEXT NOT NULL COLLATE NOCASE,

    birth_date          TEXT,

    -- Mirrors PostgreSQL status values.
    status              TEXT NOT NULL DEFAULT 'healthy'
                        CHECK(status IN ('healthy', 'sick', 'quarantine', 'sold')),

    created_at          TEXT NOT NULL DEFAULT (datetime('now')),

    CONSTRAINT uq_farm_animal_tag UNIQUE (farm_cloud_id, identification_tag)
);

-- ------------------------------------------------------------
-- TABLE 2: weight_logs
-- Offline capture of animal weight measurements.
-- Populated when NLP extracts a weight value (Rule 2
-- from Hugo's dictionary: numeric normalization).
-- Synced to Supabase weight_logs table via WorkManager.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS weight_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_id    TEXT,

    -- References local animals.id for offline joins.
    -- On sync, backend uses animal_cloud_id to match Supabase.
    animal_id       INTEGER NOT NULL,
    animal_cloud_id TEXT,

    -- REAL is SQLite's float equivalent.
    -- Matches NUMERIC(6,2) precision from PostgreSQL.
    weight_kg   REAL NOT NULL,

    log_date    TEXT NOT NULL DEFAULT (datetime('now')),

    CONSTRAINT fk_weight_animal
        FOREIGN KEY (animal_id)
        REFERENCES animals(id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- TABLE 3: health_records
-- Offline capture of health observations from voice input.
-- Populated when NLP detects symptom keywords (Rule 3
-- from Hugo's dictionary: greedy string capture).
-- Synced to Supabase health_records table via WorkManager.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS health_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_id    TEXT,

    animal_id       INTEGER NOT NULL,
    animal_cloud_id TEXT,

    -- Raw field notes captured from voice-to-text NLP output.
    -- No length limit: TEXT in SQLite is unbounded.
    symptoms_description    TEXT NOT NULL,
    diagnosis               TEXT,
    treatment_administered  TEXT,

    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),

    CONSTRAINT fk_health_animal
        FOREIGN KEY (animal_id)
        REFERENCES animals(id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- INDEXES
-- Target: validation lookups under 50ms (ticket requirement).
-- ------------------------------------------------------------

-- Primary NLP lookup index.
-- COLLATE NOCASE: matches identification_tag regardless of case.
-- Example: "405B" == "405b" == "405B" -> same result.
CREATE INDEX IF NOT EXISTS idx_animals_tag
    ON animals(identification_tag COLLATE NOCASE);

-- Composite index: farm + tag combined.
-- Covers the most common NLP query pattern:
-- "does animal X exist in farm Y?" before inserting offline data.
CREATE INDEX IF NOT EXISTS idx_animals_farm_tag
    ON animals(farm_cloud_id, identification_tag COLLATE NOCASE);

-- Accelerates weight log lookups by animal.
CREATE INDEX IF NOT EXISTS idx_weight_logs_animal
    ON weight_logs(animal_id);

-- Accelerates health record lookups by animal.
CREATE INDEX IF NOT EXISTS idx_health_records_animal
    ON health_records(animal_id);

