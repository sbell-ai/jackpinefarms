import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { farmopsTenantsTable } from "./farmops-tenants";

export const farmopsUserRoleEnum = pgEnum("farmops_user_role", [
  "owner",
  "admin",
  "member",
]);

export const farmopsUsersTable = pgTable(
  "farmops_users",
  {
    id:                   serial("id").primaryKey(),
    tenantId:             integer("tenant_id")
                            .notNull()
                            .references(() => farmopsTenantsTable.id, { onDelete: "cascade" }),
    email:                text("email").notNull(),
    passwordHash:         text("password_hash"),
    name:                 text("name").notNull(),
    phone:                text("phone"),
    role:                 farmopsUserRoleEnum("role").notNull().default("member"),
    emailVerified:        boolean("email_verified").notNull().default(false),
    verificationToken:    text("verification_token"),
    resetToken:           text("reset_token"),
    resetTokenExpiresAt:  timestamp("reset_token_expires_at", { withTimezone: true }),
    lastLoginAt:          timestamp("last_login_at", { withTimezone: true }),
    createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp("updated_at", { withTimezone: true })
                            .notNull()
                            .defaultNow()
                            .$onUpdate(() => new Date()),
  },
  (t) => [unique().on(t.tenantId, t.email)],
);

export type FarmopsUser = typeof farmopsUsersTable.$inferSelect;
