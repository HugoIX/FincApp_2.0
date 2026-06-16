-- Enable RLS on the base tables
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_assignments ENABLE ROW LEVEL SECURITY;

-- POLICY: farms
-- Users can only view farms they own
CREATE POLICY "owner_sees_own_farms"
ON farms
FOR SELECT
USING (owner_id = auth.uid());

-- POLICY: production_modules
-- Users can only view modules belonging to their own farms
-- A subquery is required because production_modules does not store owner_id directly
CREATE POLICY "owner_sees_own_modules"
ON production_modules
FOR SELECT
USING (
    farm_id IN (
        SELECT id FROM farms
        WHERE owner_id = auth.uid()
    )
);

-- POLICY: farm_assignments
-- Users can view assignments related to their farms
-- Workers can also view their own assignments
CREATE POLICY "owner_or_worker_sees_assignments"
ON farm_assignments
FOR SELECT
USING (
    farm_id IN (
        SELECT id FROM farms WHERE owner_id = auth.uid()
    )
    OR user_id = auth.uid()
);