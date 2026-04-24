console.log("[startup] ENV CHECK", {
  SUPABASE_DB_URL: !!process.env.SUPABASE_DB_URL,
  DATABASE_URL_fallback: !process.env.SUPABASE_DB_URL && !!process.env.DATABASE_URL,
  SESSION_SECRET: !!process.env.SESSION_SECRET,
  ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  SMTP_HOST: process.env.SMTP_HOST ?? null,
  SMTP_PORT: process.env.SMTP_PORT ?? null,
  SMTP_USER: !!process.env.SMTP_USER,
  SMTP_PASS: !!process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM ?? null,
});

import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate.js";
import { startTrialReminderJob } from "./jobs/trial-reminders.js";

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

// Start scheduled jobs
startTrialReminderJob();
