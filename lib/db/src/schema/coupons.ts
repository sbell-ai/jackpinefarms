import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discount_type").notNull().$type<"percent" | "fixed_cents">(),
  discountValue: integer("discount_value").notNull(),
  minOrderCents: integer("min_order_cents").notNull().default(0),
  maxRedemptions: integer("max_redemptions"),
  redemptionsCount: integer("redemptions_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  stripeCouponId: text("stripe_coupon_id"),
  stripePromotionCodeId: text("stripe_promotion_code_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Coupon = typeof couponsTable.$inferSelect;
