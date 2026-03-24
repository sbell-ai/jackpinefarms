import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const stripePendingCheckoutsTable = pgTable("stripe_pending_checkouts", {
  stripeSessionId: text("stripe_session_id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  notes: text("notes"),
  cartSnapshot: jsonb("cart_snapshot").notNull(),
  totalInCents: integer("total_in_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StripePendingCheckout = typeof stripePendingCheckoutsTable.$inferSelect;
