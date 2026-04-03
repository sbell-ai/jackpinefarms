import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { orderItemsTable } from "./orders";
import { farmopsTenantsTable } from "./farmops-tenants";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const flockSpeciesEnum = pgEnum("flock_species", [
  "chicken",
  "duck",
  "turkey",
]);

export const flockStatusEnum = pgEnum("flock_status", ["active", "retired"]);

export const flockEventTypeEnum = pgEnum("flock_event_type", [
  "acquired",
  "hatched",
  "culled",
  "sold",
  "died",
]);

export const eggInventoryLotStatusEnum = pgEnum("egg_inventory_lot_status", [
  "open",
  "depleted",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const sexEnum = pgEnum("sex_enum", ["hen", "rooster", "unknown"]);
export const animalStatusEnum = pgEnum("animal_status_enum", [
  "active",
  "sold",
  "deceased",
]);

export const flocksTable = pgTable("flocks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => farmopsTenantsTable.id),
  name: text("name").notNull(),
  species: flockSpeciesEnum("species").notNull(),
  breed: text("breed"),
  acquiredDate: date("acquired_date"),
  hatchDate: date("hatch_date"),
  ageMonths: integer("age_months"),
  henCount: integer("hen_count"),
  roosterCount: integer("rooster_count"),
  status: flockStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
});

export const flockEventsTable = pgTable(
  "flock_events",
  {
    id: serial("id").primaryKey(),
    flockId: integer("flock_id")
      .notNull()
      .references(() => flocksTable.id),
    eventType: flockEventTypeEnum("event_type").notNull(),
    count: integer("count").notNull(),
    eventDate: date("event_date").notNull(),
    notes: text("notes"),
  },
  (t) => [check("flock_events_count_positive", sql`${t.count} > 0`)],
);

export const animalsTable = pgTable("animals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => farmopsTenantsTable.id),
  name: text("name"),
  species: flockSpeciesEnum("species").notNull(),
  breed: text("breed"),
  sex: sexEnum("sex").notNull().default("unknown"),
  birthDate: date("birth_date"),
  acquiredDate: date("acquired_date"),
  status: animalStatusEnum("status").notNull().default("active"),
  flockId: integer("flock_id").references(() => flocksTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eggTypesTable = pgTable("egg_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => farmopsTenantsTable.id),
  name: text("name").notNull(),
  flockId: integer("flock_id").references(() => flocksTable.id),
  active: boolean("active").notNull().default(true),
});

export const dailyEggCollectionTable = pgTable(
  "daily_egg_collection",
  {
    id: serial("id").primaryKey(),
    eggTypeId: integer("egg_type_id")
      .notNull()
      .references(() => eggTypesTable.id),
    flockId: integer("flock_id").references(() => flocksTable.id),
    collectionDate: date("collection_date").notNull(),
    countEach: integer("count_each").notNull(),
    notes: text("notes"),
  },
  (t) => [
    check(
      "daily_egg_collection_count_non_negative",
      sql`${t.countEach} >= 0`,
    ),
    unique("daily_egg_collection_unique").on(
      t.eggTypeId,
      t.flockId,
      t.collectionDate,
    ),
  ],
);

export const eggInventoryLotsTable = pgTable(
  "egg_inventory_lots",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").references(() => farmopsTenantsTable.id),
    eggTypeId: integer("egg_type_id")
      .notNull()
      .references(() => eggTypesTable.id),
    sourceCollectionId: integer("source_collection_id").references(
      () => dailyEggCollectionTable.id,
    ),
    lotDate: date("lot_date").notNull(),
    initialQtyEach: integer("initial_qty_each").notNull(),
    remainingQtyEach: integer("remaining_qty_each").notNull(),
    status: eggInventoryLotStatusEnum("status").notNull().default("open"),
  },
  (t) => [
    check(
      "egg_inventory_lots_initial_non_negative",
      sql`${t.initialQtyEach} >= 0`,
    ),
    check(
      "egg_inventory_lots_remaining_non_negative",
      sql`${t.remainingQtyEach} >= 0`,
    ),
    check(
      "egg_inventory_lots_remaining_lte_initial",
      sql`${t.remainingQtyEach} <= ${t.initialQtyEach}`,
    ),
  ],
);

export const eggInventoryAdjustmentsTable = pgTable(
  "egg_inventory_adjustments",
  {
    id: serial("id").primaryKey(),
    eggTypeId: integer("egg_type_id")
      .notNull()
      .references(() => eggTypesTable.id),
    lotId: integer("lot_id").references(() => eggInventoryLotsTable.id),
    qtyEach: integer("qty_each").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const inventoryAllocationsTable = pgTable(
  "inventory_allocations",
  {
    id: serial("id").primaryKey(),
    orderItemId: integer("order_item_id")
      .notNull()
      .references(() => orderItemsTable.id),
    lotId: integer("lot_id")
      .notNull()
      .references(() => eggInventoryLotsTable.id),
    allocatedQtyEach: integer("allocated_qty_each").notNull(),
    allocatedAt: timestamp("allocated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "inventory_allocations_qty_positive",
      sql`${t.allocatedQtyEach} > 0`,
    ),
    unique("inventory_allocations_unique").on(t.orderItemId, t.lotId),
  ],
);

// ─── Insert schemas ───────────────────────────────────────────────────────────

export const insertFlockSchema = createInsertSchema(flocksTable).omit({
  id: true,
});
export const insertAnimalSchema = createInsertSchema(animalsTable).omit({
  id: true,
  createdAt: true,
});
export const insertFlockEventSchema = createInsertSchema(flockEventsTable).omit(
  { id: true },
);
export const insertEggTypeSchema = createInsertSchema(eggTypesTable).omit({
  id: true,
});
export const insertDailyEggCollectionSchema = createInsertSchema(
  dailyEggCollectionTable,
).omit({ id: true });
export const insertEggInventoryLotSchema = createInsertSchema(
  eggInventoryLotsTable,
).omit({ id: true });
export const insertEggInventoryAdjustmentSchema = createInsertSchema(
  eggInventoryAdjustmentsTable,
).omit({ id: true, createdAt: true });
export const insertInventoryAllocationSchema = createInsertSchema(
  inventoryAllocationsTable,
).omit({ id: true, allocatedAt: true });

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsertFlock = z.infer<typeof insertFlockSchema>;
export type Flock = typeof flocksTable.$inferSelect;

export type InsertAnimal = z.infer<typeof insertAnimalSchema>;
export type Animal = typeof animalsTable.$inferSelect;

export type InsertFlockEvent = z.infer<typeof insertFlockEventSchema>;
export type FlockEvent = typeof flockEventsTable.$inferSelect;

export type InsertEggType = z.infer<typeof insertEggTypeSchema>;
export type EggType = typeof eggTypesTable.$inferSelect;

export type InsertDailyEggCollection = z.infer<
  typeof insertDailyEggCollectionSchema
>;
export type DailyEggCollection = typeof dailyEggCollectionTable.$inferSelect;

export type InsertEggInventoryLot = z.infer<typeof insertEggInventoryLotSchema>;
export type EggInventoryLot = typeof eggInventoryLotsTable.$inferSelect;

export type InsertEggInventoryAdjustment = z.infer<
  typeof insertEggInventoryAdjustmentSchema
>;
export type EggInventoryAdjustment =
  typeof eggInventoryAdjustmentsTable.$inferSelect;

export type InsertInventoryAllocation = z.infer<
  typeof insertInventoryAllocationSchema
>;
export type InventoryAllocation = typeof inventoryAllocationsTable.$inferSelect;
