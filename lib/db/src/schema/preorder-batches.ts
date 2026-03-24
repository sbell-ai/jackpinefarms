import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const batchStatusEnum = pgEnum("batch_status", [
  "open",
  "closed",
  "complete",
]);

export const preorderBatchesTable = pgTable("preorder_batches", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id),
  name: text("name").notNull(),
  status: batchStatusEnum("status").notNull().default("open"),
  capacityBirds: integer("capacity_birds").notNull(),
  pricePerLbCentsWhole: integer("price_per_lb_cents_whole").notNull(),
  pricePerLbCentsHalf: integer("price_per_lb_cents_half").notNull(),
  pricePerLbCentsQuarter: integer("price_per_lb_cents_quarter").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPreorderBatchSchema = createInsertSchema(preorderBatchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPreorderBatch = z.infer<typeof insertPreorderBatchSchema>;
export type PreorderBatch = typeof preorderBatchesTable.$inferSelect;
