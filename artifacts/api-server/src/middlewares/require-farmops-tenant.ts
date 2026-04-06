import "../types/session.d.ts";
import { Request, Response, NextFunction } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, farmopsTenantsTable, farmopsUsersTable, farmopsSubscriptionAddonsTable } from "@workspace/db";

// Plan hierarchy — higher index = higher tier.
const PLAN_TIERS = ["starter", "growth", "pro"] as const;
export type FarmopsPlan = (typeof PLAN_TIERS)[number];

// ── requireFarmopsTenant ──────────────────────────────────────────────────────
//
// Verifies the request comes from an authenticated FarmOps user whose tenant is
// in an active or trialing (and not yet expired) state. Attaches req.farmopsUser
// and req.farmopsTenant for downstream handlers.

export async function requireFarmopsTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

  if (!user || !tenant || user.tenantId !== tenant.id) {
    delete req.session.farmopsUserId;
    delete req.session.farmopsTenantId;
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Enforce subscription status
  const now = new Date();

  if (tenant.status === "trialing") {
    if (!tenant.trialEndsAt || tenant.trialEndsAt < now) {
      res.status(402).json({
        error: "trial_expired",
        message: "Your free trial has ended. Please subscribe to continue.",
      });
      return;
    }
  } else if (tenant.status === "past_due") {
    res.status(402).json({
      error: "payment_past_due",
      message: "Your subscription payment is past due. Please update your payment method.",
    });
    return;
  } else if (tenant.status === "canceled" || tenant.status === "paused") {
    res.status(402).json({
      error: "subscription_inactive",
      message: "Your subscription is no longer active. Please resubscribe to continue.",
    });
    return;
  }
  // status === "active" — falls through

  req.farmopsTenant = tenant;
  req.farmopsUser = user;

  // Set the Postgres session variable so RLS policies allow this tenant's rows.
  // Uses set_config with is_local=false so it persists for the pooled connection
  // checkout. requireFarmopsTenant runs on every authenticated request and resets
  // it each time, so this is safe.
  try {
    await db.execute(
      sql`SELECT set_config('app.current_tenant_id', ${String(tenant.id)}, false)`
    );
  } catch {
    // Non-fatal: RLS is a safety net, app-level scoping is the primary guard.
    console.warn("[RLS] Failed to set app.current_tenant_id", tenant.id);
  }

  next();
}

// ── requireFarmopsPlan ────────────────────────────────────────────────────────
//
// Factory that returns middleware enforcing a minimum plan tier.
// Usage: router.get("/some-pro-feature", requireFarmopsTenant, requireFarmopsPlan("pro"), handler)
//
// requireFarmopsTenant must run first so req.farmopsTenant is populated.

export function requireFarmopsPlan(minimumPlan: FarmopsPlan) {
  return function planGuard(req: Request, res: Response, next: NextFunction): void {
    const tenant = req.farmopsTenant;
    if (!tenant) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const tenantTier = PLAN_TIERS.indexOf(tenant.plan as FarmopsPlan);
    const requiredTier = PLAN_TIERS.indexOf(minimumPlan);

    if (tenantTier < requiredTier) {
      res.status(403).json({
        error: "plan_upgrade_required",
        message: `This feature requires the ${minimumPlan} plan or higher.`,
        currentPlan: tenant.plan,
        requiredPlan: minimumPlan,
      });
      return;
    }

    next();
  };
}

// ── requireFarmopsAddon ───────────────────────────────────────────────────────
//
// Factory that returns async middleware enforcing that the tenant has a specific
// add-on active in farmops_subscription_addons.
// Usage: router.post("/route", requireFarmopsTenant, requireFarmopsAddon("sms_notifications"), handler)
//
// requireFarmopsTenant must run first so req.farmopsTenant is populated.

export type FarmopsAddonType =
  | "custom_domain"
  | "sms_notifications"
  | "extra_admin_users"
  | "white_label";

export function requireFarmopsAddon(addonType: FarmopsAddonType) {
  return async function addonGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
    const tenant = req.farmopsTenant;
    if (!tenant) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const [row] = await db
      .select({ id: farmopsSubscriptionAddonsTable.id })
      .from(farmopsSubscriptionAddonsTable)
      .where(
        and(
          eq(farmopsSubscriptionAddonsTable.tenantId, tenant.id),
          eq(farmopsSubscriptionAddonsTable.addonType, addonType)
        )
      )
      .limit(1);

    if (!row) {
      res.status(403).json({
        error: "addon_required",
        requiredAddon: addonType,
        message: `The ${addonType} add-on is required for this feature.`,
      });
      return;
    }

    next();
  };
}
