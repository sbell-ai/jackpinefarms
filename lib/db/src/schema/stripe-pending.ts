import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export type CartLineItem = {
  productId: number;
  productName: string;
  quantity: number;
  pricingType: string;
  unitPriceInCents: number;
  unitLabel: string | null;
  isGiblets: boolean;
  lineTotalInCents: number;
};

export const stripePendingCheckoutsTable = pgTable("stripe_pending_checkouts", {
  stripeSessionId: text("stripe_session_id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  notes: text("notes"),
  cartSnapshot: jsonb("cart_snapshot").notNull().$type<CartLineItem[]>(),
  totalInCents: integer("total_in_cents").notNull(),
  appliedCouponCode: text("applied_coupon_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StripePendingCheckout = typeof stripePendingCheckoutsTable.$inferSelect;
