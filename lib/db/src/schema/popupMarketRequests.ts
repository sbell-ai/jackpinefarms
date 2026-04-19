import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const popupMarketRequestStatusEnum = pgEnum("popup_market_request_status", [
  "new",
  "in_review",
  "confirmed",
  "declined",
]);

export const popupMarketRequestsTable = pgTable("popup_market_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  organization: text("organization"),
  eventLocation: text("event_location").notNull(),
  preferredDate: date("preferred_date"),
  alternateDate: date("alternate_date"),
  estimatedAttendees: text("estimated_attendees"),
  eventType: text("event_type"),
  productsInterested: text("products_interested").array().notNull().default([]),
  notes: text("notes"),
  status: popupMarketRequestStatusEnum("status").notNull().default("new"),
  adminNotes: text("admin_notes"),
});

export const insertPopupMarketRequestSchema = createInsertSchema(popupMarketRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPopupMarketRequest = z.infer<typeof insertPopupMarketRequestSchema>;
export type PopupMarketRequest = typeof popupMarketRequestsTable.$inferSelect;
