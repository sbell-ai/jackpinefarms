import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { platformAdminsTable } from "./platform-admins";

export const farmopsTenantStatusEnum = pgEnum("farmops_tenant_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
]);

export const farmopsPlanEnum = pgEnum("farmops_plan", [
  "starter",
  "growth",
  "pro",
]);

export const farmopsAddonTypeEnum = pgEnum("farmops_addon_type", [
  "custom_domain",
  "sms_notifications",
  "extra_admin_users",
  "white_label",
]);

export const farmopsTenantsTable = pgTable("farmops_tenants", {
  id:                        serial("id").primaryKey(),
  slug:                      text("slug").notNull().unique(),
  name:                      text("name").notNull(),
  ownerEmail:                text("owner_email").notNull(),
  status:                    farmopsTenantStatusEnum("status").notNull().default("trialing"),
  plan:                      farmopsPlanEnum("plan").notNull().default("starter"),
  stripeCustomerId:          text("stripe_customer_id").unique(),
  stripeSubscriptionId:      text("stripe_subscription_id").unique(),
  stripeSubscriptionStatus:  text("stripe_subscription_status"),
  stripePriceId:             text("stripe_price_id"),
  trialEndsAt:               timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEndsAt:       timestamp("current_period_ends_at", { withTimezone: true }),
  // One-time onboarding add-on
  onboardingPurchasedAt:     timestamp("onboarding_purchased_at", { withTimezone: true }),
  stripeOnboardingPaymentId: text("stripe_onboarding_payment_id"),
  createdByAdminId:          integer("created_by_admin_id")
                               .references(() => platformAdminsTable.id, { onDelete: "set null" }),
  createdAt:                 timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                 timestamp("updated_at", { withTimezone: true })
                               .notNull()
                               .defaultNow()
                               .$onUpdate(() => new Date()),
});

// Recurring add-ons — one row per active add-on per tenant.
// quantity is only meaningful for extra_admin_users.
export const farmopsSubscriptionAddonsTable = pgTable(
  "farmops_subscription_addons",
  {
    id:                       serial("id").primaryKey(),
    tenantId:                 integer("tenant_id")
                                .notNull()
                                .references(() => farmopsTenantsTable.id, { onDelete: "cascade" }),
    addonType:                farmopsAddonTypeEnum("addon_type").notNull(),
    quantity:                 integer("quantity").notNull().default(1),
    stripeSubscriptionItemId: text("stripe_subscription_item_id"),
    createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                timestamp("updated_at", { withTimezone: true })
                                .notNull()
                                .defaultNow()
                                .$onUpdate(() => new Date()),
  },
  (t) => [unique().on(t.tenantId, t.addonType)],
);

export type FarmopsTenant = typeof farmopsTenantsTable.$inferSelect;
export type FarmopsSubscriptionAddon = typeof farmopsSubscriptionAddonsTable.$inferSelect;
