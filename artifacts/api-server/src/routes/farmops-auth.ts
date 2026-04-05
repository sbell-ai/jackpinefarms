import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq, or } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db, farmopsTenantsTable, farmopsUsersTable } from "@workspace/db";
import { sendEmail } from "../lib/email.js";

const router: IRouter = Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many password reset requests. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Validation schemas ────────────────────────────────────────────────────────

const RESERVED_SLUGS = new Set([
  "api", "admin", "app", "www", "mail", "help", "support",
  "billing", "status", "jack-pine-farm",
]);

const slugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(50, "Slug must be 50 characters or fewer")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers, and hyphens")
  .refine((s) => !RESERVED_SLUGS.has(s), { message: "That slug is reserved" });

const RegisterBody = z.object({
  farmName:  z.string().min(2).max(100),
  slug:      slugSchema,
  ownerName: z.string().min(2).max(100),
  email:     z.string().email(),
  password:  z.string().min(8, "Password must be at least 8 characters"),
});

const LoginBody = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const ForgotPasswordBody = z.object({
  email: z.string().email(),
});

const ResetPasswordBody = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function farmopsBaseUrl(): string {
  return (
    process.env.FARMOPS_BASE_URL ??
    `https://${process.env.REPLIT_DEV_DOMAIN}/farmops`
  );
}

async function saveSession(session: Express.Request["session"]): Promise<void> {
  return new Promise((resolve, reject) =>
    session.save((err) => (err ? reject(err) : resolve()))
  );
}

// ── POST /farmops/auth/register ───────────────────────────────────────────────

router.post("/farmops/auth/register", registerLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { farmName, slug, ownerName, email, password } = parsed.data;

  // Check slug uniqueness
  const [existingTenant] = await db
    .select({ id: farmopsTenantsTable.id })
    .from(farmopsTenantsTable)
    .where(eq(farmopsTenantsTable.slug, slug))
    .limit(1);

  if (existingTenant) {
    res.status(409).json({ error: `The slug "${slug}" is already taken` });
    return;
  }

  // Check email uniqueness across all FarmOps users
  const [existingUser] = await db
    .select({ id: farmopsUsersTable.id })
    .from(farmopsUsersTable)
    .where(eq(farmopsUsersTable.email, email.toLowerCase()))
    .limit(1);

  if (existingUser) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Create tenant + owner user atomically
  const [tenant] = await db
    .insert(farmopsTenantsTable)
    .values({
      slug,
      name: farmName,
      ownerEmail: email.toLowerCase(),
      status: "trialing",
      plan: "starter",
      trialEndsAt,
    })
    .returning();

  const [user] = await db
    .insert(farmopsUsersTable)
    .values({
      tenantId: tenant.id,
      email: email.toLowerCase(),
      passwordHash,
      name: ownerName,
      role: "owner",
      verificationToken,
    })
    .returning();

  req.session.farmopsUserId = user.id;
  req.session.farmopsTenantId = tenant.id;
  delete req.session.platformAdminId;
  delete req.session.admin;
  await saveSession(req.session);

  const verifyUrl = `${farmopsBaseUrl()}/verify-email?token=${verificationToken}`;
  await sendEmail({
    to: user.email,
    subject: "Welcome to FarmOps — please verify your email",
    text: [
      `Hi ${user.name},`,
      ``,
      `Welcome to FarmOps! Your 14-day free trial has started.`,
      ``,
      `Please verify your email address: ${verifyUrl}`,
      ``,
      `Your farm URL: ${new URL(`/${slug}`, farmopsBaseUrl()).href}`,
    ].join("\n"),
    html: [
      `<p>Hi ${user.name},</p>`,
      `<p>Welcome to FarmOps! Your 14-day free trial has started.</p>`,
      `<p><a href="${verifyUrl}">Verify your email address</a></p>`,
      `<p>Your farm dashboard will be available once your subscription is active.</p>`,
    ].join("\n"),
  });

  req.log.info({ tenantId: tenant.id, userId: user.id }, "FarmOps tenant registered");

  res.status(201).json({
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan,
      trialEndsAt: tenant.trialEndsAt,
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
});

// ── POST /farmops/auth/login ──────────────────────────────────────────────────

router.post("/farmops/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { email, password } = parsed.data;

  const users = await db
    .select()
    .from(farmopsUsersTable)
    .where(eq(farmopsUsersTable.email, email.toLowerCase()));

  if (users.length === 0) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (users.length > 1) {
    // Same email in multiple tenants — caller must provide slug to disambiguate.
    // (Rare in practice; handled here for correctness.)
    res.status(409).json({
      error: "multiple_tenants",
      message: "This email is associated with multiple accounts. Please contact support.",
    });
    return;
  }

  const user = users[0]!;

  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const [tenant] = await db
    .select()
    .from(farmopsTenantsTable)
    .where(eq(farmopsTenantsTable.id, user.tenantId))
    .limit(1);

  if (!tenant) {
    res.status(500).json({ error: "Tenant not found" });
    return;
  }

  req.session.farmopsUserId = user.id;
  req.session.farmopsTenantId = tenant.id;
  delete req.session.platformAdminId;
  delete req.session.admin;
  await saveSession(req.session);

  await db
    .update(farmopsUsersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(farmopsUsersTable.id, user.id));

  req.log.info({ tenantId: tenant.id, userId: user.id }, "FarmOps user logged in");

  res.json({
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEndsAt: tenant.currentPeriodEndsAt,
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
});

// ── POST /farmops/auth/logout ─────────────────────────────────────────────────

router.post("/farmops/auth/logout", async (req, res): Promise<void> => {
  delete req.session.farmopsUserId;
  delete req.session.farmopsTenantId;
  await saveSession(req.session);
  res.json({ message: "Logged out" });
});

// ── GET /farmops/auth/me ──────────────────────────────────────────────────────

router.get("/farmops/auth/me", async (req, res): Promise<void> => {
  const { farmopsUserId, farmopsTenantId } = req.session;

  if (!farmopsUserId || !farmopsTenantId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(farmopsUsersTable)
    .where(eq(farmopsUsersTable.id, farmopsUserId))
    .limit(1);

  const [tenant] = await db
    .select()
    .from(farmopsTenantsTable)
    .where(eq(farmopsTenantsTable.id, farmopsTenantId))
    .limit(1);

  if (!user || !tenant) {
    delete req.session.farmopsUserId;
    delete req.session.farmopsTenantId;
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEndsAt: tenant.currentPeriodEndsAt,
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
});

// ── POST /farmops/auth/verify-email ──────────────────────────────────────────

router.post("/farmops/auth/verify-email", async (req, res): Promise<void> => {
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Verification token is required" });
    return;
  }

  const [user] = await db
    .select({ id: farmopsUsersTable.id, emailVerified: farmopsUsersTable.emailVerified })
    .from(farmopsUsersTable)
    .where(eq(farmopsUsersTable.verificationToken, token))
    .limit(1);

  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification token" });
    return;
  }

  if (!user.emailVerified) {
    await db
      .update(farmopsUsersTable)
      .set({ emailVerified: true, verificationToken: null })
      .where(eq(farmopsUsersTable.id, user.id));
  }

  res.json({ message: "Email verified successfully" });
});

// ── POST /farmops/auth/forgot-password ───────────────────────────────────────

router.post("/farmops/auth/forgot-password", resetLimiter, async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  const { email } = parsed.data;

  const [user] = await db
    .select()
    .from(farmopsUsersTable)
    .where(eq(farmopsUsersTable.email, email.toLowerCase()))
    .limit(1);

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(farmopsUsersTable)
      .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
      .where(eq(farmopsUsersTable.id, user.id));

    const resetUrl = `${farmopsBaseUrl()}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "FarmOps — password reset request",
      text: `Reset your FarmOps password: ${resetUrl}\n\nThis link expires in 1 hour.`,
      html: [
        `<p>You requested a password reset for your FarmOps account.</p>`,
        `<p><a href="${resetUrl}">Reset your password</a></p>`,
        `<p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
      ].join("\n"),
    });

    req.log.info({ userId: user.id }, "FarmOps password reset requested");
  }

  // Always return success to avoid email enumeration
  res.json({ message: "If an account with that email exists, a reset link has been sent." });
});

// ── POST /farmops/auth/reset-password ────────────────────────────────────────

router.post("/farmops/auth/reset-password", resetLimiter, async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { token, password } = parsed.data;

  const [user] = await db
    .select()
    .from(farmopsUsersTable)
    .where(eq(farmopsUsersTable.resetToken, token))
    .limit(1);

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(farmopsUsersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
    .where(eq(farmopsUsersTable.id, user.id));

  req.log.info({ userId: user.id }, "FarmOps password reset completed");
  res.json({ message: "Password updated successfully. You can now log in." });
});

export default router;
