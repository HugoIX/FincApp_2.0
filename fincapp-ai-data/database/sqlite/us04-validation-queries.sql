-- ------------------------------------------------------------
-- VALIDATION SCRIPT
-- Run in: SQLite Browser or Android Studio Database Inspector
-- Purpose: Confirm indexes are used for NLP lookup queries
-- ------------------------------------------------------------

-- Insert mock data for validation
INSERT INTO animals 
    (cloud_id, farm_cloud_id, type, identification_tag, status)
VALUES
    ('uuid-001', 'farm-uuid-001', 'cattle', '105A', 'healthy'),
    ('uuid-002', 'farm-uuid-001', 'swine',  '24',   'sick'),
    ('uuid-003', 'farm-uuid-002', 'cattle', '405B', 'healthy');

-- Scenario 1: Sub-50ms tag lookup (Rule 1 - Hugo's dictionary)
-- NLP extracted: "arete 105A" -> identification_tag = '105A'
EXPLAIN QUERY PLAN
SELECT * FROM animals
WHERE identification_tag = '105A' COLLATE NOCASE;

-- Scenario 2: Case-insensitive match
-- NLP extracted: "arete 405b" (lowercase) -> must match '405B'
EXPLAIN QUERY PLAN
SELECT * FROM animals
WHERE identification_tag = '405b' COLLATE NOCASE;

-- Scenario 3: Farm + tag composite lookup
-- Most common pattern: validate animal exists in specific farm
EXPLAIN QUERY PLAN
SELECT * FROM animals
WHERE farm_cloud_id = 'farm-uuid-001'
AND identification_tag = '105A' COLLATE NOCASE;