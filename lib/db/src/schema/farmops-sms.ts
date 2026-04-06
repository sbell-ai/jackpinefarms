import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { farmopsTenantsTable } from "./farmops-tenants";

export const farmopsSmsStatusEnum = pgEnum("farmops_sms_status", [
  "sent",
  "failed",
]);

export const farmopsSmsMessagesTable = pgTable("farmops_sms_messages", {
  id:           serial("id").primaryKey(),
  tenantId:     integer("tenant_id")
                  .notNull()
                  .references(() => farmopsTenantsTable.id, { onDelete: "cascade" }),
  toPhone:      text("to_phone").notNull(),
  body:         text("body").notNull(),
  status:       farmopsSmsStatusEnum("status").notNull(),
  twilioSid:    text("twilio_sid"),
  errorMessage: text("error_message"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FarmopsSmsMessage = typeof farmopsSmsMessagesTable.$inferSelect;
