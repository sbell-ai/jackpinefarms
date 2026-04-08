import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "SUPABASE_DB_URL must be set. Did you forget to configure the database?",
  );
}

const isProduction = process.env.NODE_ENV === "production";

let connectionString = dbUrl;
if (!isProduction) {
  // Dev Postgres doesn't require SSL — strip sslmode if present
  const parsedUrl = new URL(connectionString);
  parsedUrl.searchParams.delete("sslmode");
  connectionString = parsedUrl.toString();
}

export const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});
export const db = drizzle(pool, { schema });

export * from "./schema";

/**
 * runAsTenant
 *
 * Wraps a database operation in a transaction that sets the Postgres session
 * variable `app.current_tenant_id` for the duration of the transaction.
 * This satisfies the RLS policies on all FarmOps tables.
 *
 * Usage:
 *   const result = await runAsTenant(tenantId, async (tx) => {
 *     return tx.select().from(someTable);
 *   });
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
