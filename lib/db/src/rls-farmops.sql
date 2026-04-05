-- ============================================================
-- FarmOps Row Level Security
-- Run once against the database after deploying this change.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- 1. Create an app role that bypasses RLS for admin/migration tasks.
--    The API server connects as the default superuser role so it
--    bypasses RLS automatically — this role is for future use.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'farmops_app') THEN
    CREATE ROLE farmops_app;
  END IF;
END $$;

-- ============================================================
-- farmops_tenants
-- A tenant may only SELECT its own row.
-- INSERT/UPDATE/DELETE are done by the platform (superuser) only.
-- ============================================================

ALTER TABLE farmops_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmops_tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farmops_tenants_self ON farmops_tenants;
CREATE POLICY farmops_tenants_self
  ON farmops_tenants
  FOR SELECT
  USING (
    id::text = current_setting('app.current_tenant_id', true)
  );

-- ============================================================
-- farmops_users
-- ============================================================

ALTER TABLE farmops_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmops_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farmops_users_tenant ON farmops_users;
CREATE POLICY farmops_users_tenant
  ON farmops_users
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ============================================================
-- farmops_subscription_addons
-- ============================================================

ALTER TABLE farmops_subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmops_subscription_addons FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farmops_addons_tenant ON farmops_subscription_addons;
CREATE POLICY farmops_addons_tenant
  ON farmops_subscription_addons
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ============================================================
-- farmops_invitations
-- ============================================================

ALTER TABLE farmops_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmops_invitations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farmops_invitations_tenant ON farmops_invitations;
CREATE POLICY farmops_invitations_tenant
  ON farmops_invitations
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ============================================================
-- expenses
-- ============================================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_tenant ON expenses;
CREATE POLICY expenses_tenant
  ON expenses
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ============================================================
-- BYPASS: superuser and the migration role bypass RLS.
-- The API server's DB user must be a superuser OR we must grant
-- BYPASSRLS to its role. Check with: SELECT current_user;
-- If the API user is NOT a superuser, run:
--   ALTER ROLE <api_db_user> BYPASSRLS;
-- so that migrations and auth lookups (which happen before
-- app.current_tenant_id is set) still work.
-- ============================================================
