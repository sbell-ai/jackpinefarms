import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, platformAdminsTable } from "@workspace/db";

const router: IRouter = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

async function saveSession(session: Express.Request["session"]): Promise<void> {
  return new Promise((resolve, reject) =>
    session.save((err) => (err ? reject(err) : resolve()))
  );
}

// ── POST /admin/login ─────────────────────────────────────────────────────────
// Accepts { email, password }.  Looks up the platform_admins table and bcrypt-
// compares the password — no plaintext ever stored or compared.
//
// Backward-compat: also accepts the legacy { password } body (no email) and
// falls back to ADMIN_PASSWORD env-var comparison so the existing admin UI
// keeps working during the transition.

const NewLoginBody = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const LegacyLoginBody = z.object({
  password: z.string().min(1),
});

router.post("/admin/login", adminLoginLimiter, async (req, res): Promise<void> => {
  // Try new email+password path first
  const newParsed = NewLoginBody.safeParse(req.body);
  if (newParsed.success) {
    const { email, password } = newParsed.data;

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
    req.session.admin = true; // keep legacy flag set during transition
    await saveSession(req.session);

    await db
      .update(platformAdminsTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(platformAdminsTable.id, admin.id));

    req.log.info({ adminId: admin.id, email: admin.email }, "Platform admin logged in");
    res.json({ message: "Logged in", adminId: admin.id, name: admin.name });
    return;
  }

  // Legacy path: password-only body — compare against ADMIN_PASSWORD env var
  const legacyParsed = LegacyLoginBody.safeParse(req.body);
  if (legacyParsed.success) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      req.log.error("ADMIN_PASSWORD environment variable is not set");
      res.status(500).json({ error: "Admin login is not configured" });
      return;
    }

    if (legacyParsed.data.password !== adminPassword) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }

    req.session.admin = true;
    await saveSession(req.session);

    req.log.info("Platform admin logged in via legacy password");
    res.json({ message: "Logged in" });
    return;
  }

  res.status(400).json({ error: "Email and password are required" });
});

// ── POST /admin/logout ────────────────────────────────────────────────────────

router.post("/admin/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
  res.json({ message: "Logged out" });
});

// ── GET /admin/me ─────────────────────────────────────────────────────────────

router.get("/admin/me", (req, res): void => {
  const authenticated =
    Boolean(req.session.platformAdminId) || req.session.admin === true;
  res.json({ authenticated });
});

export default router;
