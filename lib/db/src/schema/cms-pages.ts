import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { farmopsTenantsTable } from "./farmops-tenants";

export const cmsPagesTable = pgTable("cms_pages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => farmopsTenantsTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  contentHtml: text("content_html").notNull().default(""),
  status: text("status").notNull().default("draft").$type<"draft" | "published">(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const cmsPageSeoTable = pgTable("cms_page_seo", {
  pageId: integer("page_id")
    .primaryKey()
    .references(() => cmsPagesTable.id, { onDelete: "cascade" }),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  canonicalUrl: text("canonical_url"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImageUrl: text("og_image_url"),
  robots: text("robots").notNull().default("index_follow").$type<"index_follow" | "noindex_nofollow">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CmsPage = typeof cmsPagesTable.$inferSelect;
export type CmsPageSeo = typeof cmsPageSeoTable.$inferSelect;
