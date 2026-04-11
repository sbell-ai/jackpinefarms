import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { farmopsTenantsTable } from "./farmops-tenants";

export const cmsMenusTable = pgTable("cms_menus", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => farmopsTenantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const cmsMenuItemsTable = pgTable("cms_menu_items", {
  id: serial("id").primaryKey(),
  menuId: integer("menu_id")
    .notNull()
    .references(() => cmsMenusTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CmsMenu = typeof cmsMenusTable.$inferSelect;
export type CmsMenuItem = typeof cmsMenuItemsTable.$inferSelect;
