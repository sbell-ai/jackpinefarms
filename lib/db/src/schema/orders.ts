import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  pgEnum,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { productsTable } from "./products";
import { preorderBatchesTable } from "./preorder-batches";
import { pickupEventsTable } from "./pickup-events";

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "deposit_paid",
  "cash_pending",
  "pickup_assigned",
  "weights_entered",
  "invoice_sent",
  "fulfilled",
  "cancelled",
  "no_show",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "stripe",
  "cash",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  status: orderStatusEnum("status").notNull().default("pending_payment"),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  totalInCents: integer("total_in_cents").notNull(),
  notes: text("notes"),
  claimToken: text("claim_token"),
  claimTokenExpiresAt: timestamp("claim_token_expires_at", { withTimezone: true }),
  batchId: integer("batch_id").references(() => preorderBatchesTable.id),
  pickupEventId: integer("pickup_event_id").references(() => pickupEventsTable.id),
  refundedGiblets: boolean("refunded_giblets").notNull().default(false),
  stripeRefundId: text("stripe_refund_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  finalWeightLbs: doublePrecision("final_weight_lbs"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  pricingType: text("pricing_type").notNull(),
  unitPriceInCents: integer("unit_price_in_cents").notNull(),
  unitLabel: text("unit_label"),
  isGiblets: boolean("is_giblets").notNull().default(false),
  lineTotalInCents: integer("line_total_in_cents").notNull(),
  pickupEventId: integer("pickup_event_id").references(() => pickupEventsTable.id),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({
  id: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
