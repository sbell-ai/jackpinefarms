import { defineConfig } from "drizzle-kit";
import path from "path";

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("SUPABASE_DB_URL must be set. Did you forget to configure the database?");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
  tablesFilter: ["!session"],
});
