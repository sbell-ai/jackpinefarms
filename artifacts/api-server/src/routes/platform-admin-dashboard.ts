import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, ilike, desc, sql, and, or, gte, lt } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import {
  db,
  platformAdminsTable,
  platformAdminAuditLogsTable,
  farmopsTenantsTable,
  farmopsUsersTable,
  farmopsSubscriptionAddonsTable,
} from "@workspace/db";
import { requirePlatformAdmin, requirePlatformAdminRole } from "../middlewares/require-platform-admin.js";
import { logAuditEvent } from "../lib/audit.js";
import { sendEmail } from "../lib/email.js";

const router: IRouter = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

function saveSession(session: Express.Request["session"]): Promise<void> {
  return new Promise((resolve, reject) =>
    session.save((err) => (err ? reject(err) : resolve()))
  );
}

// ── POST /superadmin/login ────────────────────────────────────────────────────

const LoginBody = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

router.post("/login", loginLimiter, async (req, res): Promise<void> => {
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

  req.log.info({ adminId: admin.id, email: admin.email }, "Super admin logged in");
  void logAuditEvent(admin.id, "admin.login", "admin", admin.id);
  res.json({
    id:                 admin.id,
    email:              admin.email,
    name:               admin.name,
    role:               admin.role,
    mustChangePassword: admin.mustChangePassword,
  });
});

// ── POST /superadmin/logout ───────────────────────────────────────────────────

router.post("/logout", async (req, res): Promise<void> => {
  const adminId = req.session.platformAdminId ?? null;
  await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
  if (adminId) void logAuditEvent(adminId, "admin.logout", "admin", adminId);
  res.json({ message: "Logged out" });
});

// ── GET /superadmin/me ────────────────────────────────────────────────────────

router.get("/me", requirePlatformAdmin, (req, res): void => {
  const admin = req.platformAdmin;
  if (!admin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({
    id:                 admin.id,
    email:              admin.email,
    name:               admin.name,
    role:               admin.role,
    mustChangePassword: admin.mustChangePassword,
  });
});

// ── POST /superadmin/me/change-password ───────────────────────────────────────

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
});

router.post("/me/change-password", requirePlatformAdmin, async (req, res): Promise<void> => {
  const body = ChangePasswordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "currentPassword and newPassword (min 8 chars) are required" });
    return;
  }

  const [admin] = await db
    .select({ id: platformAdminsTable.id, passwordHash: platformAdminsTable.passwordHash })
    .from(platformAdminsTable)
    .where(eq(platformAdminsTable.id, req.platformAdmin!.id))
    .limit(1);

  if (!admin) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  const valid = await bcrypt.compare(body.data.currentPassword, admin.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(body.data.newPassword, 12);
  await db
    .update(platformAdminsTable)
    .set({ passwordHash: newHash, mustChangePassword: false, passwordResetAt: null })
    .where(eq(platformAdminsTable.id, admin.id));

  req.log.info({ adminId: admin.id }, "Platform admin changed their password");
  void logAuditEvent(req.platformAdmin!.id, "admin.change_password", "admin", admin.id);
  res.json({ message: "Password updated" });
});

// ── GET /superadmin/dashboard ─────────────────────────────────────────────────
// Stats grid + trials expiring in 7 days + recent signups

const PLAN_PRICES: Record<string, number> = { starter: 29, growth: 59, pro: 99 };

router.get("/dashboard", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [counts, trialsExpiring, recentSignups] = await Promise.all([
    db
      .select({
        status: farmopsTenantsTable.status,
        plan:   farmopsTenantsTable.plan,
        cnt:    sql<number>`COUNT(*)::int`,
      })
      .from(farmopsTenantsTable)
      .groupBy(farmopsTenantsTable.status, farmopsTenantsTable.plan),

    db
      .select({
        id:          farmopsTenantsTable.id,
        slug:        farmopsTenantsTable.slug,
        name:        farmopsTenantsTable.name,
        ownerEmail:  farmopsTenantsTable.ownerEmail,
        plan:        farmopsTenantsTable.plan,
        trialEndsAt: farmopsTenantsTable.trialEndsAt,
      })
      .from(farmopsTenantsTable)
      .where(
        and(
          eq(farmopsTenantsTable.status, "trialing"),
          gte(farmopsTenantsTable.trialEndsAt, now),
          lt(farmopsTenantsTable.trialEndsAt, in7Days)
        )
      )
      .orderBy(farmopsTenantsTable.trialEndsAt),

    db
      .select({
        id:         farmopsTenantsTable.id,
        slug:       farmopsTenantsTable.slug,
        name:       farmopsTenantsTable.name,
        ownerEmail: farmopsTenantsTable.ownerEmail,
        plan:       farmopsTenantsTable.plan,
        status:     farmopsTenantsTable.status,
        createdAt:  farmopsTenantsTable.createdAt,
      })
      .from(farmopsTenantsTable)
      .orderBy(desc(farmopsTenantsTable.createdAt))
      .limit(10),
  ]);

  const totals = { total: 0, active: 0, trialing: 0, past_due: 0, canceled: 0, paused: 0 };
  let mrr = 0;
  for (const row of counts) {
    totals.total += row.cnt;
    if (row.status === "active")   totals.active   += row.cnt;
    if (row.status === "trialing") totals.trialing += row.cnt;
    if (row.status === "past_due") totals.past_due += row.cnt;
    if (row.status === "canceled") totals.canceled += row.cnt;
    if (row.status === "paused")   totals.paused   += row.cnt;
    if (row.status === "active") {
      mrr += row.cnt * (PLAN_PRICES[row.plan] ?? 0);
    }
  }

  res.json({ counts: totals, mrr, trialsExpiring, recentSignups });
});

// ── POST /superadmin/tenants ──────────────────────────────────────────────────

const CreateTenantBody = z.object({
  slug:        z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, digits, and hyphens"),
  name:        z.string().min(1),
  ownerEmail:  z.string().email(),
  plan:        z.enum(["starter", "growth", "pro"]).default("starter"),
  status:      z.enum(["trialing", "active", "past_due", "canceled", "paused"]).default("trialing"),
  trialEndsAt: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
});

router.post("/tenants", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const body = CreateTenantBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues.map((i) => i.message).join("; ") });
    return;
  }

  const { slug, name, ownerEmail, plan, status, trialEndsAt } = body.data;

  const [existing] = await db
    .select({ id: farmopsTenantsTable.id })
    .from(farmopsTenantsTable)
    .where(eq(farmopsTenantsTable.slug, slug))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: `The slug "${slug}" is already taken` });
    return;
  }

  const trialDate = trialEndsAt
    ? new Date(trialEndsAt)
    : status === "trialing"
    ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    : null;

  const [tenant] = await db
    .insert(farmopsTenantsTable)
    .values({
      slug,
      name,
      ownerEmail:       ownerEmail.toLowerCase(),
      plan,
      status,
      trialEndsAt:      trialDate,
      createdByAdminId: req.session.platformAdminId ?? null,
    })
    .returning();

  req.log.info({ adminId: req.session.platformAdminId, tenantId: tenant.id, slug }, "Tenant created manually");
  void logAuditEvent(req.session.platformAdminId!, "tenant.create", "tenant", tenant.id, { slug, plan, status });
  res.status(201).json(tenant);
});

// ── GET /superadmin/tenants ───────────────────────────────────────────────────

const TenantsQuery = z.object({
  status: z.enum(["trialing", "active", "past_due", "canceled", "paused"]).optional(),
  plan:   z.enum(["starter", "growth", "pro"]).optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().min(1).default(1),
});

router.get("/tenants", requirePlatformAdmin, async (req, res): Promise<void> => {
  const q = TenantsQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { status, plan, search, page } = q.data;
  const PAGE_SIZE = 50;
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (status) conditions.push(eq(farmopsTenantsTable.status, status));
  if (plan)   conditions.push(eq(farmopsTenantsTable.plan, plan));
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      or(
        ilike(farmopsTenantsTable.name, like),
        ilike(farmopsTenantsTable.ownerEmail, like),
        ilike(farmopsTenantsTable.slug, like)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [tenants, [{ total }]] = await Promise.all([
    db
      .select({
        id:                       farmopsTenantsTable.id,
        slug:                     farmopsTenantsTable.slug,
        name:                     farmopsTenantsTable.name,
        ownerEmail:               farmopsTenantsTable.ownerEmail,
        status:                   farmopsTenantsTable.status,
        plan:                     farmopsTenantsTable.plan,
        trialEndsAt:              farmopsTenantsTable.trialEndsAt,
        currentPeriodEndsAt:      farmopsTenantsTable.currentPeriodEndsAt,
        stripeSubscriptionStatus: farmopsTenantsTable.stripeSubscriptionStatus,
        createdAt:                farmopsTenantsTable.createdAt,
        userCount: sql<number>`(
          SELECT COUNT(*) FROM farmops_users WHERE tenant_id = ${farmopsTenantsTable.id}
        )::int`,
      })
      .from(farmopsTenantsTable)
      .where(where)
      .orderBy(desc(farmopsTenantsTable.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(farmopsTenantsTable)
      .where(where),
  ]);

  res.json({ tenants, total, page, pageSize: PAGE_SIZE });
});

// ── GET /superadmin/tenants/:id ───────────────────────────────────────────────

router.get("/tenants/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid tenant ID" });
    return;
  }

  const [tenant] = await db
    .select()
    .from(farmopsTenantsTable)
    .where(eq(farmopsTenantsTable.id, params.data.id))
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const [users, addons, [{ userCount }, { inviteCount }]] = await Promise.all([
    db
      .select({
        id:            farmopsUsersTable.id,
        email:         farmopsUsersTable.email,
        name:          farmopsUsersTable.name,
        role:          farmopsUsersTable.role,
        emailVerified: farmopsUsersTable.emailVerified,
        lastLoginAt:   farmopsUsersTable.lastLoginAt,
        createdAt:     farmopsUsersTable.createdAt,
      })
      .from(farmopsUsersTable)
      .where(eq(farmopsUsersTable.tenantId, params.data.id))
      .orderBy(desc(farmopsUsersTable.createdAt)),

    db
      .select()
      .from(farmopsSubscriptionAddonsTable)
      .where(eq(farmopsSubscriptionAddonsTable.tenantId, params.data.id)),

    Promise.all([
      db
        .select({ userCount: sql<number>`COUNT(*)::int` })
        .from(farmopsUsersTable)
        .where(eq(farmopsUsersTable.tenantId, params.data.id))
        .then((r) => r[0]),
      db
        .execute(
          sql`SELECT COUNT(*)::int AS "inviteCount" FROM farmops_invitations WHERE tenant_id = ${params.data.id}`
        )
        .then((r) => ({ inviteCount: Number((r.rows[0] as Record<string, unknown>)?.inviteCount ?? 0) })),
    ]),
  ]);

  res.json({ tenant, users, addons, usage: { userCount, inviteCount } });
});

// ── POST /superadmin/tenants/:id/suspend ──────────────────────────────────────

router.post("/tenants/:id/suspend", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid tenant ID" }); return; }

  const [updated] = await db
    .update(farmopsTenantsTable)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(farmopsTenantsTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Tenant not found" }); return; }
  req.log.info({ adminId: req.session.platformAdminId, tenantId: updated.id }, "Tenant suspended");
  void logAuditEvent(req.session.platformAdminId!, "tenant.suspend", "tenant", updated.id);
  sendEmail({
    to:      updated.ownerEmail,
    subject: "Your FarmOps account has been suspended",
    text:    `Hi,\n\nYour FarmOps account (${updated.name}) has been suspended by a platform administrator. If you believe this is an error, please contact support.\n\nThe FarmOps Team`,
    html:    `<p>Hi,</p><p>Your FarmOps account <strong>${updated.name}</strong> has been suspended by a platform administrator. If you believe this is an error, please contact support.</p><p>The FarmOps Team</p>`,
  })
    .then((r) => { if (!r.sent) req.log.warn({ provider: r.provider, error: r.error }, "Email notification failed"); })
    .catch((err: unknown) => req.log.warn({ err }, "Email notification failed"));
  res.json(updated);
});

// ── POST /superadmin/tenants/:id/reactivate ───────────────────────────────────

router.post("/tenants/:id/reactivate", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid tenant ID" }); return; }

  const [updated] = await db
    .update(farmopsTenantsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(farmopsTenantsTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Tenant not found" }); return; }
  req.log.info({ adminId: req.session.platformAdminId, tenantId: updated.id }, "Tenant reactivated");
  void logAuditEvent(req.session.platformAdminId!, "tenant.reactivate", "tenant", updated.id);
  sendEmail({
    to:      updated.ownerEmail,
    subject: "Your FarmOps account has been reactivated",
    text:    `Hi,\n\nYour FarmOps account (${updated.name}) has been reactivated. You now have full access again.\n\nThe FarmOps Team`,
    html:    `<p>Hi,</p><p>Your FarmOps account <strong>${updated.name}</strong> has been reactivated. You now have full access again.</p><p>The FarmOps Team</p>`,
  })
    .then((r) => { if (!r.sent) req.log.warn({ provider: r.provider, error: r.error }, "Email notification failed"); })
    .catch((err: unknown) => req.log.warn({ err }, "Email notification failed"));
  res.json(updated);
});

// ── POST /superadmin/tenants/:id/change-plan ──────────────────────────────────

const ChangePlanBody = z.object({
  plan: z.enum(["starter", "growth", "pro"]),
});

router.post("/tenants/:id/change-plan", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid tenant ID" }); return; }

  const body = ChangePlanBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "plan must be one of: starter, growth, pro" }); return; }

  const [updated] = await db
    .update(farmopsTenantsTable)
    .set({ plan: body.data.plan, updatedAt: new Date() })
    .where(eq(farmopsTenantsTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Tenant not found" }); return; }
  req.log.info({ adminId: req.session.platformAdminId, tenantId: updated.id, plan: body.data.plan }, "Tenant plan changed");
  void logAuditEvent(req.session.platformAdminId!, "tenant.change_plan", "tenant", updated.id, { plan: body.data.plan });
  sendEmail({
    to:      updated.ownerEmail,
    subject: `Your FarmOps plan has been updated to ${body.data.plan}`,
    text:    `Hi,\n\nYour FarmOps account (${updated.name}) has been moved to the ${body.data.plan} plan.\n\nThe FarmOps Team`,
    html:    `<p>Hi,</p><p>Your FarmOps account <strong>${updated.name}</strong> has been moved to the <strong>${body.data.plan}</strong> plan.</p><p>The FarmOps Team</p>`,
  })
    .then((r) => { if (!r.sent) req.log.warn({ provider: r.provider, error: r.error }, "Email notification failed"); })
    .catch((err: unknown) => req.log.warn({ err }, "Email notification failed"));
  res.json(updated);
});

// ── POST /superadmin/tenants/:id/extend-trial ─────────────────────────────────

const ExtendTrialBody = z.object({
  trialEndsAt: z.string().datetime({ offset: true }).or(z.string().date()),
});

router.post("/tenants/:id/extend-trial", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid tenant ID" }); return; }

  const body = ExtendTrialBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "trialEndsAt must be a valid ISO date" }); return; }

  const newDate = new Date(body.data.trialEndsAt);
  if (isNaN(newDate.getTime())) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (newDate < today) {
    res.status(400).json({ error: "trialEndsAt must be today or a future date" });
    return;
  }

  const [updated] = await db
    .update(farmopsTenantsTable)
    .set({ trialEndsAt: newDate, updatedAt: new Date() })
    .where(eq(farmopsTenantsTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Tenant not found" }); return; }
  req.log.info({ adminId: req.session.platformAdminId, tenantId: updated.id, trialEndsAt: newDate }, "Tenant trial extended");
  void logAuditEvent(req.session.platformAdminId!, "tenant.extend_trial", "tenant", updated.id, { trialEndsAt: newDate.toISOString() });
  res.json(updated);
});

// ── POST /superadmin/tenants/:id/users/:userId/set-temp-password ─────────────

function farmopsBaseUrl(): string {
  return (
    process.env.FARMOPS_BASE_URL ??
    `https://${process.env.REPLIT_DEV_DOMAIN}/farmops`
  );
}

router.post(
  "/tenants/:id/users/:userId/set-temp-password",
  requirePlatformAdminRole("owner"),
  async (req, res): Promise<void> => {
    const tenantParam = idParam.safeParse({ id: req.params.id });
    if (!tenantParam.success) { res.status(400).json({ error: "Invalid tenant ID" }); return; }

    const userIdNum = parseInt(req.params.userId as string, 10);
    if (isNaN(userIdNum) || userIdNum <= 0) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const [user] = await db
      .select({
        id:    farmopsUsersTable.id,
        email: farmopsUsersTable.email,
        name:  farmopsUsersTable.name,
        role:  farmopsUsersTable.role,
      })
      .from(farmopsUsersTable)
      .where(and(
        eq(farmopsUsersTable.id, userIdNum),
        eq(farmopsUsersTable.tenantId, tenantParam.data.id),
      ))
      .limit(1);

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (user.role === "owner") {
      res.status(400).json({ error: "Cannot set temporary password for an owner account" });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db
      .update(farmopsUsersTable)
      .set({ resetToken, resetTokenExpiresAt })
      .where(eq(farmopsUsersTable.id, user.id));

    const resetUrl = `${farmopsBaseUrl()}/reset-password?token=${resetToken}`;

    sendEmail({
      to:      user.email,
      subject: "Your JP FarmOps temporary password",
      text: [
        `Hi ${user.name},`,
        ``,
        `A platform administrator has set a temporary password for your JP FarmOps account.`,
        ``,
        `Click the link below to set a new password:`,
        resetUrl,
        ``,
        `This link expires in 48 hours. You will be prompted to set a new password when you click it.`,
        ``,
        `If you did not expect this, please contact support.`,
        ``,
        `The FarmOps Team`,
      ].join("\n"),
      html: [
        `<p>Hi ${user.name},</p>`,
        `<p>A platform administrator has set a temporary password for your JP FarmOps account.</p>`,
        `<p><a href="${resetUrl}">Click here to set a new password</a></p>`,
        `<p>This link expires in 48 hours. You will be prompted to set a new password when you click it.</p>`,
        `<p>If you did not expect this, please contact support.</p>`,
        `<p>The FarmOps Team</p>`,
      ].join("\n"),
    }).catch((err: unknown) => req.log.warn({ err, userId: user.id }, "Temp password email failed"));

    req.log.info({ adminId: req.session.platformAdminId, tenantId: tenantParam.data.id, userId: user.id }, "Temp password set for FarmOps user");
    void logAuditEvent(req.session.platformAdminId!, "tenant.set_temp_password", "farmops_user", user.id, { tenantId: tenantParam.data.id, email: user.email });

    res.json({ message: "Temporary password email sent" });
  },
);

// ── GET /superadmin/billing ───────────────────────────────────────────────────

router.get("/billing", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const planPrices: Record<string, number> = { starter: 29, growth: 59, pro: 99 };

  const [statusCounts, planCounts, tenants] = await Promise.all([
    db
      .select({ status: farmopsTenantsTable.status, cnt: sql<number>`COUNT(*)::int` })
      .from(farmopsTenantsTable)
      .groupBy(farmopsTenantsTable.status),

    db
      .select({ plan: farmopsTenantsTable.plan, cnt: sql<number>`COUNT(*)::int` })
      .from(farmopsTenantsTable)
      .where(eq(farmopsTenantsTable.status, "active"))
      .groupBy(farmopsTenantsTable.plan),

    db
      .select({
        id:                       farmopsTenantsTable.id,
        slug:                     farmopsTenantsTable.slug,
        name:                     farmopsTenantsTable.name,
        ownerEmail:               farmopsTenantsTable.ownerEmail,
        status:                   farmopsTenantsTable.status,
        plan:                     farmopsTenantsTable.plan,
        stripeCustomerId:         farmopsTenantsTable.stripeCustomerId,
        stripeSubscriptionId:     farmopsTenantsTable.stripeSubscriptionId,
        stripeSubscriptionStatus: farmopsTenantsTable.stripeSubscriptionStatus,
        currentPeriodEndsAt:      farmopsTenantsTable.currentPeriodEndsAt,
        createdAt:                farmopsTenantsTable.createdAt,
      })
      .from(farmopsTenantsTable)
      .orderBy(desc(farmopsTenantsTable.createdAt)),
  ]);

  const counts = { total: 0, active: 0, trialing: 0, past_due: 0, canceled: 0, paused: 0 };
  for (const row of statusCounts) {
    counts.total += row.cnt;
    if (row.status === "active")   counts.active   += row.cnt;
    if (row.status === "trialing") counts.trialing += row.cnt;
    if (row.status === "past_due") counts.past_due += row.cnt;
    if (row.status === "canceled") counts.canceled += row.cnt;
    if (row.status === "paused")   counts.paused   += row.cnt;
  }

  let mrr = 0;
  for (const row of planCounts) {
    mrr += row.cnt * (planPrices[row.plan] ?? 0);
  }

  res.json({ counts, mrr, tenants });
});

// ── GET /superadmin/admins ────────────────────────────────────────────────────

router.get("/admins", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const admins = await db
    .select({
      id:          platformAdminsTable.id,
      email:       platformAdminsTable.email,
      name:        platformAdminsTable.name,
      role:        platformAdminsTable.role,
      isActive:    platformAdminsTable.isActive,
      lastLoginAt: platformAdminsTable.lastLoginAt,
      createdAt:   platformAdminsTable.createdAt,
    })
    .from(platformAdminsTable)
    .orderBy(platformAdminsTable.createdAt);

  res.json(admins);
});

// ── POST /superadmin/admins ───────────────────────────────────────────────────

const CreateAdminBody = z.object({
  email: z.string().email(),
  name:  z.string().min(1),
  role:  z.enum(["owner", "support"]).default("support"),
});

router.post("/admins", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const body = CreateAdminBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "email, name are required; role must be owner or support" });
    return;
  }

  const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const [existing] = await db
    .select({ id: platformAdminsTable.id })
    .from(platformAdminsTable)
    .where(eq(platformAdminsTable.email, body.data.email.toLowerCase()))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "An admin with that email already exists" });
    return;
  }

  const [admin] = await db
    .insert(platformAdminsTable)
    .values({
      email:              body.data.email.toLowerCase(),
      name:               body.data.name,
      passwordHash,
      role:               body.data.role,
      mustChangePassword: true,
    })
    .returning({
      id:        platformAdminsTable.id,
      email:     platformAdminsTable.email,
      name:      platformAdminsTable.name,
      role:      platformAdminsTable.role,
      isActive:  platformAdminsTable.isActive,
      createdAt: platformAdminsTable.createdAt,
    });

  req.log.info({ createdBy: req.session.platformAdminId, adminId: admin.id }, "Platform admin created");
  void logAuditEvent(req.session.platformAdminId!, "admin.create", "admin", admin.id, { email: admin.email, role: admin.role });

  res.status(201).json({ ...admin, tempPassword });
});

// ── POST /superadmin/admins/:id/reset-password ───────────────────────────────

router.post("/admins/:id/reset-password", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid admin ID" }); return; }

  const [target] = await db
    .select({ id: platformAdminsTable.id, email: platformAdminsTable.email, isActive: platformAdminsTable.isActive })
    .from(platformAdminsTable)
    .where(eq(platformAdminsTable.id, params.data.id))
    .limit(1);

  if (!target) { res.status(404).json({ error: "Admin not found" }); return; }
  if (!target.isActive) { res.status(400).json({ error: "Cannot reset password for an inactive admin" }); return; }

  const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await db
    .update(platformAdminsTable)
    .set({ passwordHash, mustChangePassword: true, passwordResetAt: new Date() })
    .where(eq(platformAdminsTable.id, target.id));

  req.log.info({ actorId: req.session.platformAdminId, targetId: target.id }, "Platform admin password reset");
  void logAuditEvent(req.session.platformAdminId!, "admin.reset_password", "admin", target.id, { email: target.email });
  res.json({ id: target.id, email: target.email, tempPassword });
});

// ── POST /superadmin/admins/:id/deactivate ────────────────────────────────────

router.post("/admins/:id/deactivate", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid admin ID" }); return; }

  if (params.data.id === req.session.platformAdminId) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const [updated] = await db
    .update(platformAdminsTable)
    .set({ isActive: false })
    .where(eq(platformAdminsTable.id, params.data.id))
    .returning({ id: platformAdminsTable.id, email: platformAdminsTable.email });

  if (!updated) { res.status(404).json({ error: "Admin not found" }); return; }

  req.log.info({ actorId: req.session.platformAdminId, targetId: updated.id }, "Platform admin deactivated");
  void logAuditEvent(req.session.platformAdminId!, "admin.deactivate", "admin", updated.id, { email: updated.email });
  res.json({ message: "Admin deactivated", ...updated });
});

// ── GET /superadmin/audit-logs ────────────────────────────────────────────────

const AuditLogsQuery = z.object({
  adminId:    z.coerce.number().int().positive().optional(),
  action:     z.string().optional(),
  targetType: z.string().optional(),
  from:       z.string().datetime({ offset: true }).optional(),
  to:         z.string().datetime({ offset: true }).optional(),
  page:       z.coerce.number().int().min(1).default(1),
});

router.get("/audit-logs", requirePlatformAdmin, async (req, res): Promise<void> => {
  const q = AuditLogsQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { adminId, action, targetType, from, to, page } = q.data;
  const PAGE_SIZE = 100;
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (adminId)    conditions.push(eq(platformAdminAuditLogsTable.adminId, adminId));
  if (action)     conditions.push(ilike(platformAdminAuditLogsTable.action, `%${action}%`));
  if (targetType) conditions.push(eq(platformAdminAuditLogsTable.targetType, targetType));
  if (from)       conditions.push(gte(platformAdminAuditLogsTable.createdAt, new Date(from)));
  if (to)         conditions.push(lt(platformAdminAuditLogsTable.createdAt, new Date(to)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, [{ total }]] = await Promise.all([
    db
      .select({
        id:           platformAdminAuditLogsTable.id,
        action:       platformAdminAuditLogsTable.action,
        targetType:   platformAdminAuditLogsTable.targetType,
        targetId:     platformAdminAuditLogsTable.targetId,
        metadata:     platformAdminAuditLogsTable.metadata,
        createdAt:    platformAdminAuditLogsTable.createdAt,
        adminId:      platformAdminAuditLogsTable.adminId,
        adminEmail:   platformAdminsTable.email,
        adminName:    platformAdminsTable.name,
      })
      .from(platformAdminAuditLogsTable)
      .leftJoin(platformAdminsTable, eq(platformAdminAuditLogsTable.adminId, platformAdminsTable.id))
      .where(where)
      .orderBy(desc(platformAdminAuditLogsTable.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(platformAdminAuditLogsTable)
      .where(where),
  ]);

  res.json({ logs, total, page, pageSize: PAGE_SIZE });
});

// ── POST /superadmin/tenants/:id/addons ──────────────────────────────────────

const ADDON_TYPES = ["custom_domain", "sms_notifications", "extra_admin_users", "white_label"] as const;

const AddAddonBody = z.object({
  addonType: z.enum(ADDON_TYPES),
  quantity:  z.number().int().min(1).default(1),
});

router.post("/tenants/:id/addons", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid tenant ID" }); return; }

  const body = AddAddonBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "addonType is required; quantity must be ≥ 1" }); return; }

  const [tenantExists] = await db
    .select({ id: farmopsTenantsTable.id })
    .from(farmopsTenantsTable)
    .where(eq(farmopsTenantsTable.id, params.data.id))
    .limit(1);
  if (!tenantExists) { res.status(404).json({ error: "Tenant not found" }); return; }

  const [addon] = await db
    .insert(farmopsSubscriptionAddonsTable)
    .values({
      tenantId:  params.data.id,
      addonType: body.data.addonType,
      quantity:  body.data.quantity,
    })
    .onConflictDoUpdate({
      target: [farmopsSubscriptionAddonsTable.tenantId, farmopsSubscriptionAddonsTable.addonType],
      set: { quantity: body.data.quantity, updatedAt: new Date() },
    })
    .returning();

  req.log.info({ adminId: req.session.platformAdminId, tenantId: params.data.id, addonType: body.data.addonType }, "Tenant add-on upserted");
  void logAuditEvent(req.session.platformAdminId!, "tenant.addon_add", "tenant", params.data.id, { addonType: body.data.addonType, quantity: body.data.quantity });
  res.status(201).json(addon);
});

// ── DELETE /superadmin/tenants/:id/addons/:addonType ─────────────────────────

const addonTypeParam = z.object({ addonType: z.enum(ADDON_TYPES) });

router.delete("/tenants/:id/addons/:addonType", requirePlatformAdminRole("owner"), async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid tenant ID" }); return; }

  const addonParam = addonTypeParam.safeParse({ addonType: req.params.addonType });
  if (!addonParam.success) { res.status(400).json({ error: "Invalid add-on type" }); return; }

  const [deleted] = await db
    .delete(farmopsSubscriptionAddonsTable)
    .where(
      and(
        eq(farmopsSubscriptionAddonsTable.tenantId, params.data.id),
        eq(farmopsSubscriptionAddonsTable.addonType, addonParam.data.addonType),
      )
    )
    .returning({ id: farmopsSubscriptionAddonsTable.id });

  if (!deleted) { res.status(404).json({ error: "Add-on not found" }); return; }

  req.log.info({ adminId: req.session.platformAdminId, tenantId: params.data.id, addonType: addonParam.data.addonType }, "Tenant add-on removed");
  void logAuditEvent(req.session.platformAdminId!, "tenant.addon_remove", "tenant", params.data.id, { addonType: addonParam.data.addonType });
  res.json({ message: "Add-on removed" });
});

export default router;
