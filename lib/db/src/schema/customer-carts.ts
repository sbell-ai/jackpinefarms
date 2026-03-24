import { pgTable, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export type SessionCartItem = {
  productId: number;
  quantity: number;
  addGiblets: boolean;
};

export const customerCartsTable = pgTable("customer_carts", {
  customerId: integer("customer_id")
    .primaryKey()
    .references(() => customersTable.id, { onDelete: "cascade" }),
  items: jsonb("items").notNull().$type<SessionCartItem[]>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomerCart = typeof customerCartsTable.$inferSelect;
