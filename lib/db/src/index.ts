import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isProduction = process.env.NODE_ENV === "production";

let connectionString = process.env.DATABASE_URL;
if (!isProduction) {
  // Dev Postgres doesn't require SSL — strip sslmode if present
  const dbUrl = new URL(connectionString);
  dbUrl.searchParams.delete("sslmode");
  connectionString = dbUrl.toString();
}

export const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
