console.log("[startup] ENV CHECK", {
  DATABASE_URL: !!process.env.DATABASE_URL,
  SESSION_SECRET: !!process.env.SESSION_SECRET,
  ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
});

import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate.js";

const port = Number(process.env["PORT"] || 8080);

// Health check — must respond before DB is ready
app.get("/", (_req, res) => res.status(200).send("OK"));

// Bind immediately so the health check is reachable within the 2-second window
app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening");
});

// Run migrations after the server is already accepting connections
runMigrations().catch((err) => {
  logger.error({ err }, "DB migration failed");
});
