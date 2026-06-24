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