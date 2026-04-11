import { pgTable, serial, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { farmopsTenantsTable } from "./farmops-tenants";

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => farmopsTenantsTable.id, { onDelete: "set null" }),
  code: text("code").notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull().$type<"percent" | "amount">(),
  discountValue: integer("discount_value").notNull(),
  maxRedemptions: integer("max_redemptions"),
  redemptionsCount: integer("redemptions_count").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  stripeCouponId: text("stripe_coupon_id"),
  stripePromotionCodeId: text("stripe_promotion_code_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("coupons_code_tenant_unique").on(t.code, t.tenantId),
]);

export type Coupon = typeof couponsTable.$inferSelect;
