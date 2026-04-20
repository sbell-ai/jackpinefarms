import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, platformAdminsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/require-platform-admin.js";
import { sendSms } from "../lib/sms.js";

const router: IRouter = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts — you have been rate limited. Please wait 15 minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

async function saveSession(session: Express.Request["session"]): Promise<void> {
  return new Promise((resolve, reject) =>
    session.save((err) => (err ? reject(err) : resolve()))
  );
}

// ── POST /admin/login ─────────────────────────────────────────────────────────

const LoginBody = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

router.post("/admin/login", adminLoginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const { email, password } = parsed.data;

  const [admin] = await db
    .select()
    .from(platformAdminsTable)
    .where(eq(platformAdminsTable.email, email.toLowerCase()))
    .limit(1);

  if (!admin || !admin.isActive || !(await bcrypt.compare(password, admin.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.platformAdminId = admin.id;
  delete req.session.farmopsUserId;
  delete req.session.farmopsTenantId;
  await saveSession(req.session);

  await db
    .update(platformAdminsTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(platformAdminsTable.id, admin.id));

  req.log.info({ adminId: admin.id, email: admin.email }, "Platform admin logged in");
  res.setHeader("Cache-Control", "no-store");
  res.json({ message: "Logged in", adminId: admin.id, name: admin.name });
});

// ── POST /admin/logout ────────────────────────────────────────────────────────

router.post("/admin/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
  res.json({ message: "Logged out" });
});

// ── GET /admin/me ─────────────────────────────────────────────────────────────

router.get("/admin/me", (req, res): void => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ authenticated: Boolean(req.session.platformAdminId) });
});

// ── POST /admin/sms/test ──────────────────────────────────────────────────────
// Sends a test SMS to ADMIN_PHONE. Returns the send result.

router.post("/admin/sms/test", requirePlatformAdmin, async (req, res): Promise<void> => {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) {
    res.status(400).json({ error: "ADMIN_PHONE environment variable is not set" });
    return;
  }

  const result = await sendSms({ to: adminPhone, body: "Test SMS from Jack Pine Farms admin." });
  req.log.info({ result }, "Admin test SMS sent");
  res.json(result);
});

// ── GET /admin/debug/request-info ─────────────────────────────────────────────
// Returns the raw proxy headers as seen by the server. Useful for diagnosing
// subdomain routing when running behind a reverse proxy (e.g. in production).
// Requires platform admin authentication.

router.get("/admin/debug/request-info", requirePlatformAdmin, (req, res): void => {
  res.json({
    host_header:       req.headers.host,
    x_forwarded_host:  req.headers["x-forwarded-host"],
    x_forwarded_for:   req.headers["x-forwarded-for"],
    x_forwarded_proto: req.headers["x-forwarded-proto"],
    hostname:          req.hostname,
    protocol:          req.protocol,
    secure:            req.secure,
    ip:                req.ip,
    url:               req.url,
  });
});

export default router;
