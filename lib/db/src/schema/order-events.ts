import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

export const orderEventTypeEnum = pgEnum("order_event_type", [
  "note",
  "status_change",
  "refund",
  "invoice_sent",
  "pickup_assigned",
  "weights_entered",
]);

export const orderEventsTable = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  eventType: orderEventTypeEnum("event_type").notNull(),
  body: text("body").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderEventSchema = createInsertSchema(orderEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertOrderEvent = z.infer<typeof insertOrderEventSchema>;
export type OrderEvent = typeof orderEventsTable.$inferSelect;
