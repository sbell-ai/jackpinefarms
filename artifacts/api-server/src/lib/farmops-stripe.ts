/**
 * Shared Stripe client and price-ID map for FarmOps subscriptions.
 *
 * Price IDs are configured via environment variables so they can differ
 * between test and live Stripe modes without code changes.
 *
 * Required env vars (all optional — billing is disabled if STRIPE_SECRET_KEY
 * is absent, but individual price vars must be set before that plan/addon
 * can be purchased):
 *
 *   STRIPE_SECRET_KEY
 *   FARMOPS_STRIPE_WEBHOOK_SECRET     (separate from Jack Pine webhook secret)
 *
 *   FARMOPS_PRICE_STARTER             monthly recurring price ID
 *   FARMOPS_PRICE_GROWTH
 *   FARMOPS_PRICE_PRO
 *
 *   FARMOPS_PRICE_ADDON_CUSTOM_DOMAIN
 *   FARMOPS_PRICE_ADDON_SMS
 *   FARMOPS_PRICE_ADDON_EXTRA_ADMIN   (per-user recurring)
 *   FARMOPS_PRICE_ADDON_WHITE_LABEL
 *   FARMOPS_PRICE_ONBOARDING          one-time price ID
 */

export type FarmopsPlanKey = "starter" | "growth" | "pro";
export type FarmopsAddonKey =
  | "custom_domain"
  | "sms_notifications"
  | "extra_admin_users"
  | "white_label";

export function getPlanPriceId(plan: FarmopsPlanKey): string | undefined {
  const map: Record<FarmopsPlanKey, string | undefined> = {
    starter: process.env.FARMOPS_PRICE_STARTER,
    growth:  process.env.FARMOPS_PRICE_GROWTH,
    pro:     process.env.FARMOPS_PRICE_PRO,
  };
  return map[plan];
}

export function getAddonPriceId(addon: FarmopsAddonKey): string | undefined {
  const map: Record<FarmopsAddonKey, string | undefined> = {
    custom_domain:       process.env.FARMOPS_PRICE_ADDON_CUSTOM_DOMAIN,
    sms_notifications:   process.env.FARMOPS_PRICE_ADDON_SMS,
    extra_admin_users:   process.env.FARMOPS_PRICE_ADDON_EXTRA_ADMIN,
    white_label:         process.env.FARMOPS_PRICE_ADDON_WHITE_LABEL,
  };
  return map[addon];
}

export function getOnboardingPriceId(): string | undefined {
  return process.env.FARMOPS_PRICE_ONBOARDING;
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" }) as import("stripe").default;
}

export function farmopsBaseUrl(): string {
  return (
    process.env.FARMOPS_BASE_URL ??
    `https://${process.env.REPLIT_DEV_DOMAIN}/farmops`
  );
}
