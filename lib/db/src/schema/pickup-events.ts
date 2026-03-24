import {
  pgTable,
  text,
  serial,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pickupEventStatusEnum = pgEnum("pickup_event_status", [
  "scheduled",
  "completed",
  "cancelled",
]);

export const pickupEventsTable = pgTable("pickup_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  locationNotes: text("location_notes"),
  status: pickupEventStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPickupEventSchema = createInsertSchema(pickupEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPickupEvent = z.infer<typeof insertPickupEventSchema>;
export type PickupEvent = typeof pickupEventsTable.$inferSelect;
