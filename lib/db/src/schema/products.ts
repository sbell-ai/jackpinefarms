import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productTypeEnum = pgEnum("product_type", [
  "eggs_chicken",
  "eggs_duck",
  "meat_chicken",
  "meat_turkey",
]);

export const availabilityStatusEnum = pgEnum("availability_status", [
  "taking_orders",
  "preorder",
  "sold_out",
  "disabled",
]);

export const pricingTypeEnum = pgEnum("pricing_type", ["unit", "deposit"]);

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  productType: productTypeEnum("product_type").notNull(),
  pricingType: pricingTypeEnum("pricing_type").notNull(),
  priceInCents: integer("price_in_cents").notNull(),
  unitLabel: text("unit_label"),
  depositDescription: text("deposit_description"),
  availability: availabilityStatusEnum("availability").notNull().default("taking_orders"),
  imageUrl: text("image_url"),
  isOnSale: boolean("is_on_sale").notNull().default(false),
  salePriceCents: integer("sale_price_cents"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

export const productImagesTable = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  altText: text("alt_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductImage = typeof productImagesTable.$inferSelect;
