import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { platformAdminsTable } from "./platform-admins";

export const platformAdminAuditLogsTable = pgTable(
  "platform_admin_audit_logs",
  {
    id:         serial("id").primaryKey(),
    adminId:    integer("admin_id").references(() => platformAdminsTable.id, { onDelete: "set null" }),
    action:     text("action").notNull(),
    targetType: text("target_type"),
    targetId:   integer("target_id"),
    metadata:   jsonb("metadata"),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_logs_admin_created").on(t.adminId, t.createdAt),
    index("idx_audit_logs_created").on(t.createdAt),
  ]
);

export type PlatformAdminAuditLog = typeof platformAdminAuditLogsTable.$inferSelect;
