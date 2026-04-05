# FarmOps — Postgres Row Level Security (RLS) Implementation Spec

Hand this entire document to Claude in Replit Shell as your instruction.

---

## Objective

Add Postgres Row Level Security (RLS) to all FarmOps tables that contain a `tenant_id`
column. This is a **database-level safety net only** — it does not replace the existing
application-level tenant scoping in route handlers. No route handler logic changes.
No OpenAPI spec changes. No frontend changes.

The only files that change are:

1. A new SQL migration file in `lib/db/src/`
2. `artifacts/api-server/src/middlewares/require-farmops-tenant.ts` — set the session
   variable after authentication succeeds
3. `lib/db/src/index.ts` — export a helper to set the tenant context on a connection

---

## Background: How Postgres RLS Works Here

RLS policies can reference a **session-local variable** set with `SET LOCAL`. We will use
`app.current_tenant_id`. The flow is:

1. `requireFarmopsTenant` middleware authenticates the request and populates
   `req.farmopsTenant`.
2. Before calling `next()`, it runs `SET LOCAL app.current_tenant_id = '<id>'` on the
   same DB connection used for the request. Because Drizzle uses a connection pool, we
   wrap this in a short transaction.
3. Postgres RLS policies on the FarmOps tables check
   `current_setting('app.current_tenant_id', true)` and only allow rows where
   `tenant_id` matches.

> **Important:** `SET LOCAL` only lasts for the duration of the current transaction.
> For the safety net to work, queries must run inside the same transaction where the
> variable was set. The implementation below uses `db.transaction()` for this.

---

## Tables That Need RLS

| Table | tenant_id column | Notes |
|---|---|---|
| `farmops_users` | `tenant_id` | RLS on all operations |
| `farmops_subscription_addons` | `tenant_id` | RLS on all operations |
| `farmops_invitations` | `tenant_id` | RLS on all operations |
| `expenses` | `tenant_id` | RLS on all operations |
| `farmops_tenants` | `id` (is the tenant) | SELECT only — a tenant can only read its own row |

---

## Step 1 — Create the SQL Migration File

Create a new file at `lib/db/src/rls-farmops.sql` with exactly this content:

```sql
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
```

---

## Step 2 — Add a DB helper to set tenant context

In `lib/db/src/index.ts`, add and export this function (add it at the bottom, do not
remove anything):

```typescript
import { sql } from "drizzle-orm";

/**
 * runAsTenant
 *
 * Wraps a database operation in a transaction that sets the Postgres session
 * variable `app.current_tenant_id` for the duration of the transaction.
 * This satisfies the RLS policies on all FarmOps tables.
 *
 * Usage in middleware:
 *   const result = await runAsTenant(tenantId, async (tx) => {
 *     return tx.select().from(someTable);
 *   });
 *
 * Usage in route handlers that already have a transaction:
 *   Pass the existing `tx` directly rather than nesting transactions.
 */
export async function runAsTenant<T>(
  tenantId: number,
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${String(tenantId)}, true)`
    );
    return fn(tx as unknown as typeof db);
  });
}
```

---

## Step 3 — Update `require-farmops-tenant.ts`

In `artifacts/api-server/src/middlewares/require-farmops-tenant.ts`, find these lines
at the end of the middleware (just before `next()`):

```typescript
  req.farmopsTenant = tenant;
  req.farmopsUser = user;
  next();
```

Change those three lines to:

```typescript
  req.farmopsTenant = tenant;
  req.farmopsUser = user;

  // Set the Postgres session variable so RLS policies allow this tenant's rows.
  // Uses set_config with is_local=false so it persists for the pooled connection
  // checkout. requireFarmopsTenant runs on every authenticated request and resets
  // it each time, so this is safe.
  try {
    await db.execute(
      sql`SELECT set_config('app.current_tenant_id', ${String(tenant.id)}, false)`
    );
  } catch {
    // Non-fatal: RLS is a safety net, app-level scoping is the primary guard.
    // Log but don't block the request.
    console.warn("[RLS] Failed to set app.current_tenant_id", tenant.id);
  }

  next();
```

Add this import at the top of the file if not already present:

```typescript
import { sql } from "drizzle-orm";
```

---

## Step 4 — Apply the SQL migration

After creating the SQL file, run it against the database:

```bash
psql "$DATABASE_URL" -f lib/db/src/rls-farmops.sql
```

If `psql` is not available, run the SQL via Node:

```bash
node -e "
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() =>
  client.query(fs.readFileSync('lib/db/src/rls-farmops.sql', 'utf8'))
).then(() => { console.log('RLS applied'); client.end(); })
.catch(e => { console.error(e); client.end(); process.exit(1); });
"
```

---

## Step 5 — Verify

Run these SQL queries to confirm RLS is active:

```sql
-- Should show relrowsecurity = true for each table
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN (
  'farmops_tenants',
  'farmops_users',
  'farmops_subscription_addons',
  'farmops_invitations',
  'expenses'
);

-- Should list the 5 policies we created
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN (
  'farmops_tenants',
  'farmops_users',
  'farmops_subscription_addons',
  'farmops_invitations',
  'expenses'
);
```

---

## What NOT to change

- Do not touch any route handlers — they already scope by `tenantId` and that stays
- Do not touch `farmops-auth.ts` — registration and login run before a tenant session
  exists; RLS is bypassed for those by the superuser DB role
- Do not touch `farmops-billing.ts` webhook handlers — same reason
- Do not add RLS to Jack Pine Store tables (`orders`, `customers`, `products`, etc.) —
  those are single-tenant and don't need it
- Do not run `pnpm --filter @workspace/db run push` — RLS is applied via raw SQL, not
  Drizzle schema push

---

## Rollback (if needed)

```sql
ALTER TABLE farmops_tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE farmops_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE farmops_subscription_addons DISABLE ROW LEVEL SECURITY;
ALTER TABLE farmops_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
```
