-- ============================================================
-- FincApp | PostgreSQL Livestock Schema Implementation
-- Script   : postgresql-livestock-schema.sql
-- Author   : José Miguel (US-10-JOSEMIGUEL)
-- Purpose  : Consolidated DDL script for full cloud schema
--            deployment on Supabase PostgreSQL instance.
--            Serves as single source of truth for backend
--            (Sergio) and analytics (Hugo) compatibility review.
-- Run in   : Supabase SQL Editor
-- Depends  : None — run on a fresh Supabase project
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1: Custom ENUM Types
-- Must be created before any table that references them.
-- ------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('admin', 'worker');
CREATE TYPE production_type AS ENUM ('cattle', 'swine', 'poultry');


-- ------------------------------------------------------------
-- STEP 2: Users Table
-- Root entity — all farms and assignments depend on this table.
-- ------------------------------------------------------------

CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          user_role    NOT NULL DEFAULT 'worker',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- STEP 3: Farms Table
-- Belongs to one owner (user). Cascade deletes all nested data.
-- ------------------------------------------------------------

CREATE TABLE farms (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID         NOT NULL,
    name       VARCHAR(100) NOT NULL,
    location   VARCHAR(255),
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_farm_owner
        FOREIGN KEY (owner_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ------------------------------------------------------------
-- STEP 4: Farm Assignments Table
-- Bridge table resolving many-to-many between users and farms.
-- Allows multiple workers to be assigned to multiple farms.
-- ------------------------------------------------------------

CREATE TABLE farm_assignments (
    id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID      NOT NULL,
    farm_id     UUID      NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_assignment_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_assignment_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_user_farm_assignment
        UNIQUE (user_id, farm_id)
);


-- ------------------------------------------------------------
-- STEP 5: Production Modules Table
-- One module per production type per farm (enforced by UNIQUE).
-- Soft deactivation via is_active preserves historical records.
-- ------------------------------------------------------------

CREATE TABLE production_modules (
    id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id    UUID            NOT NULL,
    type       production_type NOT NULL,
    is_active  BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_module_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_farm_module_type
        UNIQUE (farm_id, type)
);

-- ------------------------------------------------------------
-- STEP 6: Animals Table
-- Core asset table linked directly to the farm tenant.
-- Cascade deletes all weight logs and health records on removal.
-- ------------------------------------------------------------

CREATE TABLE animals (
    id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id            UUID            NOT NULL,
    type               production_type NOT NULL,
    identification_tag VARCHAR(50)     NOT NULL,
    birth_date         DATE,
    status             VARCHAR(50)     NOT NULL DEFAULT 'healthy',
    created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_animal_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(id)
        ON DELETE CASCADE,

    -- Prevents duplicate tags within the same farm.
    -- Different farms may reuse the same tag sequence.
    CONSTRAINT uq_farm_animal_tag
        UNIQUE (farm_id, identification_tag)
);


-- ------------------------------------------------------------
-- STEP 7: Weight Logs Table
-- Time-series capture of animal mass. No overwrites allowed —
-- every measurement creates a new row for full audit trail.
-- ------------------------------------------------------------

CREATE TABLE weight_logs (
    id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID         NOT NULL,
    weight_kg NUMERIC(6,2) NOT NULL,
    log_date  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_weight_animal
        FOREIGN KEY (animal_id)
        REFERENCES animals(id)
        ON DELETE CASCADE
);


-- ------------------------------------------------------------
-- STEP 8: Health Records Table
-- Stores clinical observations for n8n + LLM automation pipeline.
-- Raw symptoms captured from voice-to-text NLP output.
-- ------------------------------------------------------------

CREATE TABLE health_records (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id              UUID         NOT NULL,
    symptoms_description   TEXT         NOT NULL,
    diagnosis              VARCHAR(150),
    treatment_administered VARCHAR(255),
    recorded_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_health_animal
        FOREIGN KEY (animal_id)
        REFERENCES animals(id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- STEP 9: Sync Telemetry Logs Table
-- Audits offline-to-cloud transactional payloads sent by
-- mobile devices. Records device, farm, status, row counts,
-- and error payloads for partial sync failure tracking.
-- ------------------------------------------------------------

CREATE TABLE sync_telemetry_logs (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    device_uuid      VARCHAR(100) NOT NULL,
    user_id          UUID         NOT NULL,
    farm_id          UUID         NOT NULL,
    status           VARCHAR(30)  NOT NULL,
    rows_synced      INTEGER      NOT NULL DEFAULT 0,
    error_message    TEXT,
    synchronized_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sync_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT fk_sync_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- STEP 10: Performance Indexes (B-Tree)
-- Target: analytical query responses under 200ms.
-- ------------------------------------------------------------

-- Core schema indexes
CREATE INDEX idx_farms_owner
    ON farms(owner_id);

CREATE INDEX idx_modules_farm_type
    ON production_modules(farm_id, type);

-- Animal inventory indexes
CREATE INDEX idx_animals_farm
    ON animals(farm_id);

-- Composite index: farm + animal for scoped analytical queries
CREATE INDEX idx_animals_farm_animal
    ON animals(farm_id, id);

-- Time-series indexes
CREATE INDEX idx_weight_animal
    ON weight_logs(animal_id);

CREATE INDEX idx_health_animal
    ON health_records(animal_id);

-- Sync telemetry index
CREATE INDEX idx_sync_telemetry_farm
    ON sync_telemetry_logs(farm_id);

-- ------------------------------------------------------------
-- STEP 11: Test Seed Data
-- Validates that all tables accept inserts and foreign key
-- constraints are correctly enforced.
-- Remove before deploying to production environment.
-- ------------------------------------------------------------

-- Seed users
INSERT INTO users (id, email, password_hash, role) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'carlos@fincapp.com', 'hash_test_1', 'admin'),
    ('a0000000-0000-0000-0000-000000000002', 'maria@fincapp.com',  'hash_test_2', 'admin');

-- Seed farms
INSERT INTO farms (id, owner_id, name, location) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Finca El Roble', 'Antioquia'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Finca La Palma', 'Córdoba');

-- Seed production modules
INSERT INTO production_modules (farm_id, type, is_active) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'cattle',  TRUE),
    ('b0000000-0000-0000-0000-000000000001', 'swine',   TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'poultry', TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'cattle',  FALSE);

-- Seed animals
INSERT INTO animals (id, farm_id, type, identification_tag, status) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'cattle', '105A', 'healthy'),
    ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'swine',  '24',   'sick'),
    ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'cattle', '405B', 'healthy');

-- Seed weight logs
INSERT INTO weight_logs (animal_id, weight_kg) VALUES
    ('c0000000-0000-0000-0000-000000000001', 450.00),
    ('c0000000-0000-0000-0000-000000000002', 120.50),
    ('c0000000-0000-0000-0000-000000000003', 380.75);

-- Seed health records
INSERT INTO health_records (animal_id, symptoms_description, diagnosis) VALUES
    ('c0000000-0000-0000-0000-000000000002', 'tos severa y decaimiento', 'bronquitis porcina');

-- Seed sync telemetry
INSERT INTO sync_telemetry_logs 
    (device_uuid, user_id, farm_id, status, rows_synced) VALUES
    ('device-test-001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'success', 42);

-- ============================================================
-- Schema deployment complete.
-- Sub-task 5: pending Sergio review (API compatibility)
-- Sub-task 6: pending Hugo review (analytics compatibility)
-- ============================================================

