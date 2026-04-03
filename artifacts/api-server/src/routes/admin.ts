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
  await saveSession(req.session);

  await db
    .update(platformAdminsTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(platformAdminsTable.id, admin.id));

  req.log.info({ adminId: admin.id, email: admin.email }, "Platform admin logged in");
  res.json({ message: "Logged in", adminId: admin.id, name: admin.name });
});

// ── POST /admin/logout ────────────────────────────────────────────────────────

router.post("/admin/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
  res.json({ message: "Logged out" });
});

// ── GET /admin/me ─────────────────────────────────────────────────────────────

router.get("/admin/me", (req, res): void => {
  res.json({ authenticated: Boolean(req.session.platformAdminId) });
});

export default router;
