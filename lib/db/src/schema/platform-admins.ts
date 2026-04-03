import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Platform administrators — the operators of the FarmOps SaaS platform
 * (i.e. the Jack Pine Farm team).  Completely separate from:
 *   - farmops_users  (tenant-scoped farmers)
 *   - customers      (storefront shoppers)
 *
 * Replaces the previous single shared ADMIN_PASSWORD env-var credential.
 * The first row is seeded by the startup migration from ADMIN_PASSWORD (bcrypt-hashed).
 */
export const platformAdminsTable = pgTable("platform_admins", {
  id:          serial("id").primaryKey(),
  email:       text("email").notNull().unique(),
  name:        text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive:    boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt:   timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformAdmin = typeof platformAdminsTable.$inferSelect;
