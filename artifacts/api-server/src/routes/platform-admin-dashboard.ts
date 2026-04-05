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
  farmopsTenantsTable,
  farmopsUsersTable,
  farmopsSubscriptionAddonsTable,
} from "@workspace/db";
import { requirePlatformAdmin, requirePlatformAdminRole } from "../middlewares/require-platform-admin.js";

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
  res.json({
    id:    admin.id,
    email: admin.email,
    name:  admin.name,
    role:  admin.role,
  });
});

// ── POST /superadmin/logout ───────────────────────────────────────────────────

router.post("/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
  res.json({ message: "Logged out" });
});

// ── GET /superadmin/me ────────────────────────────────────────────────────────

router.get("/me", requirePlatformAdmin, (req, res): void => {
  const admin = req.platformAdmin;
  if (!admin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(admin);
});

// ── GET /superadmin/dashboard ─────────────────────────────────────────────────
// Stats grid + trials expiring in 7 days + recent signups

const PLAN_PRICES: Record<string, number> = { starter: 29, growth: 79, pro: 149 };

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

  const [updated] = await db
    .update(farmopsTenantsTable)
    .set({ trialEndsAt: newDate, updatedAt: new Date() })
    .where(eq(farmopsTenantsTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Tenant not found" }); return; }
  req.log.info({ adminId: req.session.platformAdminId, tenantId: updated.id, trialEndsAt: newDate }, "Tenant trial extended");
  res.json(updated);
});

// ── GET /superadmin/billing ───────────────────────────────────────────────────

router.get("/billing", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const planPrices: Record<string, number> = { starter: 29, growth: 79, pro: 149 };

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
      email:        body.data.email.toLowerCase(),
      name:         body.data.name,
      passwordHash,
      role:         body.data.role,
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

  res.status(201).json({ ...admin, tempPassword });
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
  res.json({ message: "Admin deactivated", ...updated });
});

export default router;
