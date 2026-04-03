import { Router, type IRouter } from "express";
import { eq, desc, count, sql } from "drizzle-orm";
import { z } from "zod";
import { db, farmopsTenantsTable, farmopsUsersTable, farmopsSubscriptionAddonsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/require-platform-admin.js";

const router: IRouter = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

// ── GET /platform/tenants ─────────────────────────────────────────────────────
// List all FarmOps tenants with user counts and subscription status.
// Super admin only.

router.get("/platform/tenants", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const tenants = await db
    .select({
      id:                       farmopsTenantsTable.id,
      slug:                     farmopsTenantsTable.slug,
      name:                     farmopsTenantsTable.name,
      ownerEmail:               farmopsTenantsTable.ownerEmail,
      status:                   farmopsTenantsTable.status,
      plan:                     farmopsTenantsTable.plan,
      trialEndsAt:              farmopsTenantsTable.trialEndsAt,
      currentPeriodEndsAt:      farmopsTenantsTable.currentPeriodEndsAt,
      stripeCustomerId:         farmopsTenantsTable.stripeCustomerId,
      stripeSubscriptionId:     farmopsTenantsTable.stripeSubscriptionId,
      stripeSubscriptionStatus: farmopsTenantsTable.stripeSubscriptionStatus,
      createdAt:                farmopsTenantsTable.createdAt,
      userCount: sql<number>`(
        SELECT COUNT(*) FROM farmops_users WHERE tenant_id = ${farmopsTenantsTable.id}
      )::int`,
    })
    .from(farmopsTenantsTable)
    .orderBy(desc(farmopsTenantsTable.createdAt));

  res.json(tenants);
});

// ── GET /platform/tenants/:id ─────────────────────────────────────────────────
// Full detail for a single tenant: tenant record, all users, active add-ons.

router.get("/platform/tenants/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
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

  const users = await db
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
    .orderBy(desc(farmopsUsersTable.createdAt));

  const addons = await db
    .select()
    .from(farmopsSubscriptionAddonsTable)
    .where(eq(farmopsSubscriptionAddonsTable.tenantId, params.data.id));

  res.json({ tenant, users, addons });
});

// ── PATCH /platform/tenants/:id ───────────────────────────────────────────────
// Override tenant plan or status (e.g. manually activate, grant pro, cancel).

const PatchTenantBody = z.object({
  status: z.enum(["trialing", "active", "past_due", "canceled", "paused"]).optional(),
  plan:   z.enum(["starter", "growth", "pro"]).optional(),
});

router.patch("/platform/tenants/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid tenant ID" });
    return;
  }

  const parsed = PatchTenantBody.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Provide at least one of: status, plan" });
    return;
  }

  const [updated] = await db
    .update(farmopsTenantsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(farmopsTenantsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  req.log.info(
    { adminId: req.session.platformAdminId, tenantId: updated.id, changes: parsed.data },
    "Platform admin updated tenant"
  );

  res.json(updated);
});

export default router;
