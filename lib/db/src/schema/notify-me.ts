import { pgTable, text, serial, integer, timestamp, unique, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const notifyMeTable = pgTable(
  "notify_me",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    globalUnsubscribe: boolean("global_unsubscribe").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.productId, t.email)],
);

export const insertNotifyMeSchema = createInsertSchema(notifyMeTable).omit({
  id: true,
  createdAt: true,
});
export type InsertNotifyMe = z.infer<typeof insertNotifyMeSchema>;
export type NotifyMe = typeof notifyMeTable.$inferSelect;
