import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  farmopsTenantsTable,
  farmopsSubscriptionAddonsTable,
} from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";
import {
  getStripe,
  getPlanPriceId,
  getAddonPriceId,
  getOnboardingPriceId,
  farmopsBaseUrl,
  type FarmopsPlanKey,
  type FarmopsAddonKey,
} from "../lib/farmops-stripe.js";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get or create a Stripe Customer for this tenant and cache the ID. */
async function ensureStripeCustomer(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  tenantId: number,
  email: string,
  name: string
): Promise<string> {
  const [tenant] = await db
    .select({ stripeCustomerId: farmopsTenantsTable.stripeCustomerId })
    .from(farmopsTenantsTable)
    .where(eq(farmopsTenantsTable.id, tenantId))
    .limit(1);

  if (tenant?.stripeCustomerId) return tenant.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { farmopsTenantId: String(tenantId) },
  });

  await db
    .update(farmopsTenantsTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(farmopsTenantsTable.id, tenantId));

  return customer.id;
}

// ── POST /farmops/billing/checkout ────────────────────────────────────────────
// Create a Stripe Checkout Session for subscribing to a plan.
// The tenant's trial days remaining are passed as trial_end so Stripe aligns
// the billing cycle with the existing trial rather than restarting it.

const CheckoutBody = z.object({
  plan: z.enum(["starter", "growth", "pro"]),
});

router.post(
  "/farmops/billing/checkout",
  requireFarmopsTenant,
  requireFarmopsRole("owner"),
  async (req, res): Promise<void> => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Billing is not configured on this server." });
      return;
    }

    const parsed = CheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const tenant = req.farmopsTenant!;
    const user   = req.farmopsUser!;
    const plan   = parsed.data.plan as FarmopsPlanKey;

    const priceId = getPlanPriceId(plan);
    if (!priceId) {
      res.status(503).json({ error: `Price ID for plan "${plan}" is not configured.` });
      return;
    }

    const customerId = await ensureStripeCustomer(
      stripe,
      tenant.id,
      user.email,
      tenant.name
    );

    // If the tenant still has trial days remaining, carry them forward.
    const now = Date.now();
    const trialEnd =
      tenant.trialEndsAt && new Date(tenant.trialEndsAt).getTime() > now
        ? Math.floor(new Date(tenant.trialEndsAt).getTime() / 1000)
        : undefined;

    const base = farmopsBaseUrl();

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_end: trialEnd,
        metadata: {
          farmopsTenantId: String(tenant.id),
          plan,
        },
      },
      metadata: {
        farmopsTenantId: String(tenant.id),
        type: "farmops_subscription",
        plan,
      },
      success_url: `${base}/dashboard?subscribed=1`,
      cancel_url:  `${base}/billing?canceled=1`,
      allow_promotion_codes: true,
    });

    req.log.info({ tenantId: tenant.id, plan }, "FarmOps billing checkout session created");
    res.json({ url: session.url });
  }
);

// ── POST /farmops/billing/portal ──────────────────────────────────────────────
// Create a Stripe Billing Portal session so the owner can manage their
// subscription, update payment method, view invoices, and cancel.

router.post(
  "/farmops/billing/portal",
  requireFarmopsTenant,
  requireFarmopsRole("owner"),
  async (req, res): Promise<void> => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Billing is not configured on this server." });
      return;
    }

    const tenant = req.farmopsTenant!;

    if (!tenant.stripeCustomerId) {
      res.status(400).json({
        error: "no_subscription",
        message: "No active subscription found. Please subscribe first.",
      });
      return;
    }

    const base = farmopsBaseUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer:   tenant.stripeCustomerId,
      return_url: `${base}/billing`,
    });

    res.json({ url: session.url });
  }
);

// ── POST /farmops/billing/addons ──────────────────────────────────────────────
// Add or remove recurring subscription add-ons.
// Body: { action: "add"|"remove", addon: FarmopsAddonKey, quantity?: number }

const AddonBody = z.object({
  action:   z.enum(["add", "remove"]),
  addon:    z.enum(["custom_domain", "sms_notifications", "extra_admin_users", "white_label"]),
  quantity: z.number().int().min(1).max(50).optional().default(1),
});

router.post(
  "/farmops/billing/addons",
  requireFarmopsTenant,
  requireFarmopsRole("owner"),
  async (req, res): Promise<void> => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Billing is not configured on this server." });
      return;
    }

    const parsed = AddonBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const tenant = req.farmopsTenant!;
    const { action, addon, quantity } = parsed.data;

    if (!tenant.stripeSubscriptionId) {
      res.status(400).json({
        error: "no_subscription",
        message: "You must have an active subscription before adding add-ons.",
      });
      return;
    }

    if (action === "add") {
      const priceId = getAddonPriceId(addon as FarmopsAddonKey);
      if (!priceId) {
        res.status(503).json({ error: `Price ID for add-on "${addon}" is not configured.` });
        return;
      }

      // Check if already active
      const [existing] = await db
        .select()
        .from(farmopsSubscriptionAddonsTable)
        .where(
          and(
            eq(farmopsSubscriptionAddonsTable.tenantId, tenant.id),
            eq(farmopsSubscriptionAddonsTable.addonType, addon)
          )
        )
        .limit(1);

      if (existing) {
        // Update quantity on existing subscription item
        await stripe.subscriptionItems.update(existing.stripeSubscriptionItemId!, {
          quantity,
        });
        await db
          .update(farmopsSubscriptionAddonsTable)
          .set({ quantity, updatedAt: new Date() })
          .where(eq(farmopsSubscriptionAddonsTable.id, existing.id));

        res.json({ message: `Add-on "${addon}" quantity updated to ${quantity}.` });
        return;
      }

      // Add new subscription item
      const item = await stripe.subscriptionItems.create({
        subscription: tenant.stripeSubscriptionId,
        price:        priceId,
        quantity,
        proration_behavior: "create_prorations",
      });

      await db.insert(farmopsSubscriptionAddonsTable).values({
        tenantId:                 tenant.id,
        addonType:                addon,
        quantity,
        stripeSubscriptionItemId: item.id,
      });

      req.log.info({ tenantId: tenant.id, addon, quantity }, "FarmOps add-on activated");
      res.status(201).json({ message: `Add-on "${addon}" activated.`, item: item.id });

    } else {
      // action === "remove"
      const [existing] = await db
        .select()
        .from(farmopsSubscriptionAddonsTable)
        .where(
          and(
            eq(farmopsSubscriptionAddonsTable.tenantId, tenant.id),
            eq(farmopsSubscriptionAddonsTable.addonType, addon)
          )
        )
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: `Add-on "${addon}" is not currently active.` });
        return;
      }

      if (existing.stripeSubscriptionItemId) {
        await stripe.subscriptionItems.del(existing.stripeSubscriptionItemId, {
          proration_behavior: "create_prorations",
        });
      }

      await db
        .delete(farmopsSubscriptionAddonsTable)
        .where(eq(farmopsSubscriptionAddonsTable.id, existing.id));

      req.log.info({ tenantId: tenant.id, addon }, "FarmOps add-on removed");
      res.json({ message: `Add-on "${addon}" removed.` });
    }
  }
);

// ── POST /farmops/billing/onboarding ─────────────────────────────────────────
// One-time Stripe Checkout Session for the $99 onboarding add-on.

router.post(
  "/farmops/billing/onboarding",
  requireFarmopsTenant,
  requireFarmopsRole("owner"),
  async (req, res): Promise<void> => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Billing is not configured on this server." });
      return;
    }

    const tenant = req.farmopsTenant!;
    const user   = req.farmopsUser!;

    if (tenant.onboardingPurchasedAt) {
      res.status(409).json({ error: "Onboarding has already been purchased for this account." });
      return;
    }

    const priceId = getOnboardingPriceId();
    if (!priceId) {
      res.status(503).json({ error: "Onboarding price is not configured." });
      return;
    }

    const customerId = await ensureStripeCustomer(
      stripe,
      tenant.id,
      user.email,
      tenant.name
    );

    const base = farmopsBaseUrl();

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        farmopsTenantId: String(tenant.id),
        type: "farmops_onboarding",
      },
      success_url: `${base}/dashboard?onboarding=1`,
      cancel_url:  `${base}/billing?canceled=1`,
    });

    req.log.info({ tenantId: tenant.id }, "FarmOps onboarding checkout session created");
    res.json({ url: session.url });
  }
);

// ── GET /farmops/billing ──────────────────────────────────────────────────────
// Return the tenant's current billing state: plan, status, addons, trial info.

router.get(
  "/farmops/billing",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenant = req.farmopsTenant!;

    const addons = await db
      .select({
        addonType: farmopsSubscriptionAddonsTable.addonType,
        quantity:  farmopsSubscriptionAddonsTable.quantity,
        createdAt: farmopsSubscriptionAddonsTable.createdAt,
      })
      .from(farmopsSubscriptionAddonsTable)
      .where(eq(farmopsSubscriptionAddonsTable.tenantId, tenant.id));

    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

    res.json({
      plan:                     tenant.plan,
      status:                   tenant.status,
      trialEndsAt:              tenant.trialEndsAt,
      currentPeriodEndsAt:      tenant.currentPeriodEndsAt,
      hasStripeCustomer:        Boolean(tenant.stripeCustomerId),
      hasActiveSubscription:    Boolean(tenant.stripeSubscriptionId),
      onboardingPurchased:      Boolean(tenant.onboardingPurchasedAt),
      stripeConfigured,
      addons,
    });
  }
);

export default router;
