-- 1. Ensure basic schema access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Reset and ensure base table permissions for all public tables
-- Note: RLS will still filter the actual rows.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- Apply to existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 3. Sequence permissions (required for many inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Specific Appointment RLS refinement if needed (currently they look okay but let's be sure)
-- The current policies are:
-- "View appointments in same org" -> (organization_id = current_user_org_id())
-- "Create appointments if member of org" -> (organization_id = current_user_org_id())
-- ... which depend on helper functions.

-- Ensure helper functions are accessible
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
