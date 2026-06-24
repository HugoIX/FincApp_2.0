-- Create custom Enum types for data constraint validation
CREATE TYPE user_role AS ENUM ('admin', 'worker');
CREATE TYPE production_type AS ENUM ('cattle', 'swine', 'poultry');

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'worker',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Farms Table
CREATE TABLE farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_farm_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Farm Assignments Table (Bridge table for workers)
CREATE TABLE farm_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    farm_id UUID NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assignment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_farm FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_farm_assignment UNIQUE (user_id, farm_id)
);

-- 4. Production Modules Table (Dynamic Multi-Business activation)
CREATE TABLE production_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL,
    type production_type NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_module_farm FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    CONSTRAINT uq_farm_module_type UNIQUE (farm_id, type)
);

-- Indexing strategies for multi-tenant analytical speed optimization
CREATE INDEX idx_farms_owner ON farms(owner_id);
CREATE INDEX idx_modules_farm_type ON production_modules(farm_id, type);

----------------------------------------------------------------------------------------------------

-- ============================================================================
-- SPRINT 1 (CONTINUATION): ANIMAL INVENTORY & HEALTH LOGGING SUB-SCHEMA
-- ============================================================================

-- 5. Animals Base Table
-- Core asset table linked directly to the farm tenant for absolute data isolation.
CREATE TABLE animals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL,
    type production_type NOT NULL, -- Inherited enum from core architecture (cattle, swine, poultry)
    identification_tag VARCHAR(50) NOT NULL, -- Ear tag, microchip, or custom code
    birth_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'healthy', -- Tracking states: healthy, sick, quarantine, sold
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Multi-Tenant Structural Integrity Rules
    CONSTRAINT fk_animal_farm FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    
    -- Business Guardrail: Prevents duplicate tags inside the same farm, 
    -- but allows different farms to reuse the same tag sequence.
    CONSTRAINT uq_farm_animal_tag UNIQUE (farm_id, identification_tag)
);

-- 6. Weight Logs Table (Time-Series Analytics)
-- Captures animal mass fluctuations over time. No overwrites allowed.
CREATE TABLE weight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID NOT NULL,
    weight_kg NUMERIC(6, 2) NOT NULL, -- Supports precise weights up to 9999.99 kg (e.g., heavy cattle clusters)
    log_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_weight_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE
);

-- 7. Health Records Table (AI Cloud Ingestion Layer)
-- Stores clinical observations that will trigger Juan Pablo's n8n + LLM automation pipeline.
CREATE TABLE health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID NOT NULL,
    symptoms_description TEXT NOT NULL, -- Raw field notes or voice-to-text outputs
    diagnosis VARCHAR(150),
    treatment_administered VARCHAR(255),
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_health_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE
);

-- ============================================================================
-- PERFORMANCE OPTIMIZATION LAYER (B-TREE INDEXES)
-- Target: Maintain downstream analytical query responses under 200ms.
-- ============================================================================

-- Accelerates multi-tenant filtering when retrieving the inventory of a specific farm
CREATE INDEX idx_animals_farm ON animals(farm_id);

-- Accelerates time-series line charts for individual animal weight progression
CREATE INDEX idx_weight_animal ON weight_logs(animal_id);

-- Accelerates background real-time queries for the cloud AI health webhook
CREATE INDEX idx_health_animal ON health_records(animal_id);


-- ============================================================================
-- SPRINT 1 (CONTINUATION): SYNC ORCHESTRATION & ANALYTICAL SUB-SCHEMA
-- ============================================================================

-- 8. Sync Telemetry Logs Table
-- Audits offline-to-cloud transactional payloads sent by mobile devices.
CREATE TABLE sync_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_uuid VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL,
    farm_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL, -- 'success', 'failed', 'partial_conflict'
    rows_synced INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    synchronized_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_sync_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_sync_farm FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
);

-- ============================================================================
-- ANALYTICAL AGGREGATION LAYER (DATABASE VIEWS)
-- Target: Abstract complex analytical joins into high-performance reporting structures.
-- ============================================================================

-- View: view_farm_inventory_analytics
-- Pre-calculates headcount and status distribution across different farms and production lines.
CREATE OR REPLACE VIEW view_farm_inventory_analytics AS
SELECT 
    f.id AS farm_id,
    f.name AS farm_name,
    a.type AS production_line,
    a.status AS health_status,
    COUNT(a.id) AS total_headcount,
    MAX(a.created_at) AS last_inventory_update
FROM farms f
LEFT JOIN animals a ON f.id = a.farm_id
GROUP BY f.id, f.name, a.type, a.status;

-- View: view_animal_weight_performance
-- Extracts time-series metrics to isolate the latest weight and track asset development scales.
CREATE OR REPLACE VIEW view_animal_weight_performance AS
SELECT 
    a.farm_id,
    w.animal_id,
    a.identification_tag,
    a.type AS production_line,
    ROUND(AVG(w.weight_kg), 2) AS lifetime_average_weight,
    MAX(w.weight_kg) AS maximum_recorded_weight,
    COUNT(w.id) AS total_weighing_sessions
FROM animals a
JOIN weight_logs w ON a.id = w.animal_id
GROUP BY a.farm_id, w.animal_id, a.identification_tag, a.type;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION LAYER (B-TREE INDEXES)
-- ============================================================================

-- Accelerates background real-time queries for telemetry audits and sync dashboard tracking
CREATE INDEX idx_sync_telemetry_farm ON sync_telemetry_logs(farm_id);