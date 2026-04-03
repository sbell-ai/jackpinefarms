import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { farmopsTenantsTable } from "./farmops-tenants";
import { farmopsUsersTable, farmopsUserRoleEnum } from "./farmops-users";

export const farmopsInvitationsTable = pgTable("farmops_invitations", {
  id:              serial("id").primaryKey(),
  tenantId:        integer("tenant_id")
                     .notNull()
                     .references(() => farmopsTenantsTable.id, { onDelete: "cascade" }),
  email:           text("email").notNull(),
  role:            farmopsUserRoleEnum("role").notNull().default("member"),
  token:           text("token").notNull().unique(),
  invitedByUserId: integer("invited_by_user_id").references(
                     () => farmopsUsersTable.id,
                     { onDelete: "set null" }
                   ),
  acceptedAt:      timestamp("accepted_at", { withTimezone: true }),
  expiresAt:       timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FarmopsInvitation = typeof farmopsInvitationsTable.$inferSelect;
