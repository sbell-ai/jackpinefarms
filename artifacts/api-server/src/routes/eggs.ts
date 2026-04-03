import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, and, gte, lte, isNull, sum, sql, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  flocksTable,
  flockEventsTable,
  animalsTable,
  eggTypesTable,
  dailyEggCollectionTable,
  eggInventoryLotsTable,
  eggInventoryAdjustmentsTable,
  inventoryAllocationsTable,
  ordersTable,
  orderItemsTable,
  productsTable,
  insertFlockSchema,
  insertFlockEventSchema,
  insertAnimalSchema,
  insertEggTypeSchema,
  insertDailyEggCollectionSchema,
  insertEggInventoryAdjustmentSchema,
} from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/require-admin.js";
import {
  AdminAllocateEggsParams,
  AdminGetEggAllocationsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Local query schemas (orval generates zod.date() which rejects JSON strings)
const dateRangeQuery = z.object({
  eggTypeId: z.coerce.number().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// ─── Flocks ───────────────────────────────────────────────────────────────────

router.get("/admin/flocks", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const flocks = await db.select().from(flocksTable).orderBy(flocksTable.name);
  res.json(flocks);
});

router.post("/admin/flocks", requirePlatformAdmin, async (req, res): Promise<void> => {
  const parsed = insertFlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [flock] = await db.insert(flocksTable).values(parsed.data).returning();
  res.status(201).json(flock);
});

router.put("/admin/flocks/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid flock id" }); return; }
  const parsed = insertFlockSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [updated] = await db
    .update(flocksTable)
    .set(parsed.data)
    .where(eq(flocksTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Flock not found" }); return; }
  res.json(updated);
});

// ─── Flock Events ─────────────────────────────────────────────────────────────

router.get(
  "/admin/flocks/:id/events",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const flockId = parseInt(String(req.params.id), 10);
    if (isNaN(flockId)) { res.status(400).json({ error: "Invalid flock id" }); return; }
    const events = await db
      .select()
      .from(flockEventsTable)
      .where(eq(flockEventsTable.flockId, flockId))
      .orderBy(asc(flockEventsTable.eventDate));
    res.json(events);
  },
);

router.post(
  "/admin/flocks/:id/events",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const flockId = parseInt(String(req.params.id), 10);
    if (isNaN(flockId)) { res.status(400).json({ error: "Invalid flock id" }); return; }
    const parsed = insertFlockEventSchema.safeParse({ ...req.body, flockId });
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const [event] = await db.insert(flockEventsTable).values(parsed.data).returning();
    res.status(201).json(event);
  },
);

// ─── Animals ──────────────────────────────────────────────────────────────────

router.get("/admin/animals", requirePlatformAdmin, async (req, res): Promise<void> => {
  const flockIdParam = req.query.flockId ? parseInt(String(req.query.flockId), 10) : undefined;
  const rows = await db
    .select()
    .from(animalsTable)
    .where(flockIdParam ? eq(animalsTable.flockId, flockIdParam) : undefined)
    .orderBy(asc(animalsTable.createdAt));
  res.json(rows);
});

router.post("/admin/animals", requirePlatformAdmin, async (req, res): Promise<void> => {
  const parsed = insertAnimalSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [animal] = await db.insert(animalsTable).values(parsed.data).returning();
  res.status(201).json(animal);
});

// ─── Egg Types ────────────────────────────────────────────────────────────────

router.get(
  "/admin/egg-types",
  requirePlatformAdmin,
  async (_req, res): Promise<void> => {
    const eggTypes = await db
      .select()
      .from(eggTypesTable)
      .orderBy(eggTypesTable.name);
    res.json(eggTypes);
  },
);

router.post(
  "/admin/egg-types",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const parsed = insertEggTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [eggType] = await db
      .insert(eggTypesTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(eggType);
  },
);

// ─── Daily Egg Collection ─────────────────────────────────────────────────────

router.get(
  "/admin/egg-collection",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const parsed = dateRangeQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { eggTypeId, fromDate, toDate } = parsed.data;

    const conditions = [];
    if (eggTypeId !== undefined)
      conditions.push(eq(dailyEggCollectionTable.eggTypeId, eggTypeId));
    if (fromDate !== undefined)
      conditions.push(gte(dailyEggCollectionTable.collectionDate, fromDate));
    if (toDate !== undefined)
      conditions.push(lte(dailyEggCollectionTable.collectionDate, toDate));

    const records = await db
      .select()
      .from(dailyEggCollectionTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(dailyEggCollectionTable.collectionDate));

    res.json(records);
  },
);

router.post(
  "/admin/egg-collection",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const parsed = insertDailyEggCollectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [collection] = await tx
          .insert(dailyEggCollectionTable)
          .values(parsed.data)
          .returning();

        const [lot] = await tx
          .insert(eggInventoryLotsTable)
          .values({
            eggTypeId: collection.eggTypeId,
            sourceCollectionId: collection.id,
            lotDate: collection.collectionDate,
            initialQtyEach: collection.countEach,
            remainingQtyEach: collection.countEach,
            status: "open" as const,
          })
          .returning();

        return { collection, lot };
      });

      res.status(201).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        res.status(409).json({
          error: "A collection for this egg type and date already exists.",
        });
        return;
      }
      throw err;
    }
  },
);

// ─── Inventory Adjustments ────────────────────────────────────────────────────

router.get(
  "/admin/egg-adjustments",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const parsed = dateRangeQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { eggTypeId, fromDate, toDate } = parsed.data;

    const conditions = [];
    if (eggTypeId !== undefined)
      conditions.push(eq(eggInventoryAdjustmentsTable.eggTypeId, eggTypeId));
    if (fromDate !== undefined)
      conditions.push(
        gte(
          sql`${eggInventoryAdjustmentsTable.createdAt}::date`,
          sql`${fromDate}::date`,
        ),
      );
    if (toDate !== undefined)
      conditions.push(
        lte(
          sql`${eggInventoryAdjustmentsTable.createdAt}::date`,
          sql`${toDate}::date`,
        ),
      );

    const adjustments = await db
      .select()
      .from(eggInventoryAdjustmentsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(eggInventoryAdjustmentsTable.createdAt));

    res.json(adjustments);
  },
);

router.post(
  "/admin/egg-adjustments",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const parsed = insertEggInventoryAdjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { eggTypeId, lotId, qtyEach, reason } = parsed.data;

    try {
      const result = await db.transaction(async (tx) => {
        if (lotId != null) {
          const [lot] = await tx
            .select()
            .from(eggInventoryLotsTable)
            .where(eq(eggInventoryLotsTable.id, lotId));

          if (!lot) {
            throw Object.assign(new Error("Lot not found"), { status: 404 });
          }

          const newRemaining = lot.remainingQtyEach + qtyEach;
          if (newRemaining < 0) {
            throw Object.assign(
              new Error(
                `Adjustment would make remaining qty negative (current: ${lot.remainingQtyEach}, delta: ${qtyEach})`,
              ),
              { status: 400 },
            );
          }

          await tx
            .update(eggInventoryLotsTable)
            .set({
              remainingQtyEach: newRemaining,
              status: newRemaining === 0 ? "depleted" : "open",
            })
            .where(eq(eggInventoryLotsTable.id, lotId));
        }

        const [adjustment] = await tx
          .insert(eggInventoryAdjustmentsTable)
          .values({ eggTypeId, lotId: lotId ?? null, qtyEach, reason })
          .returning();

        return adjustment;
      });

      res.status(201).json(result);
    } catch (err: unknown) {
      const httpErr = err as { status?: number; message?: string };
      if (httpErr.status) {
        res.status(httpErr.status).json({ error: httpErr.message });
        return;
      }
      throw err;
    }
  },
);

router.patch(
  "/admin/egg-adjustments/:id",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid adjustment id" }); return; }

    const bodySchema = z.object({
      qtyEach: z.number().int(),
      reason: z.string().min(1),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const { qtyEach: newQty, reason } = parsed.data;

    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(eggInventoryAdjustmentsTable)
          .where(eq(eggInventoryAdjustmentsTable.id, id));

        if (!existing) {
          throw Object.assign(new Error("Adjustment not found"), { status: 404 });
        }

        if (existing.lotId != null) {
          const delta = newQty - existing.qtyEach;
          const [lot] = await tx
            .select()
            .from(eggInventoryLotsTable)
            .where(eq(eggInventoryLotsTable.id, existing.lotId))
            .for("update");

          if (!lot) {
            throw Object.assign(new Error("Associated lot not found"), { status: 404 });
          }

          const newRemaining = lot.remainingQtyEach + delta;
          if (newRemaining < 0) {
            throw Object.assign(
              new Error(`Edit would make lot remaining qty negative (current: ${lot.remainingQtyEach}, delta: ${delta})`),
              { status: 400 },
            );
          }

          await tx
            .update(eggInventoryLotsTable)
            .set({
              remainingQtyEach: newRemaining,
              status: newRemaining === 0 ? "depleted" : "open",
            })
            .where(eq(eggInventoryLotsTable.id, existing.lotId));
        }

        const [updated] = await tx
          .update(eggInventoryAdjustmentsTable)
          .set({ qtyEach: newQty, reason })
          .where(eq(eggInventoryAdjustmentsTable.id, id))
          .returning();

        return updated;
      });

      res.json(result);
    } catch (err: unknown) {
      const httpErr = err as { status?: number; message?: string };
      if (httpErr.status) {
        res.status(httpErr.status).json({ error: httpErr.message });
        return;
      }
      throw err;
    }
  },
);

// ─── Inventory On Hand ────────────────────────────────────────────────────────

router.get(
  "/admin/egg-inventory/on-hand",
  requirePlatformAdmin,
  async (_req, res): Promise<void> => {
    const [eggTypes, lotTotals, adjTotals] = await Promise.all([
      db.select().from(eggTypesTable),
      db
        .select({
          eggTypeId: eggInventoryLotsTable.eggTypeId,
          total: sum(eggInventoryLotsTable.remainingQtyEach),
        })
        .from(eggInventoryLotsTable)
        .where(sql`${eggInventoryLotsTable.status} != 'depleted'`)
        .groupBy(eggInventoryLotsTable.eggTypeId),
      db
        .select({
          eggTypeId: eggInventoryAdjustmentsTable.eggTypeId,
          total: sum(eggInventoryAdjustmentsTable.qtyEach),
        })
        .from(eggInventoryAdjustmentsTable)
        .where(isNull(eggInventoryAdjustmentsTable.lotId))
        .groupBy(eggInventoryAdjustmentsTable.eggTypeId),
    ]);

    const lotMap = new Map(
      lotTotals.map((l) => [l.eggTypeId, Number(l.total ?? 0)]),
    );
    const adjMap = new Map(
      adjTotals.map((a) => [a.eggTypeId, Number(a.total ?? 0)]),
    );

    const onHand = eggTypes.map((et) => ({
      eggTypeId: et.id,
      eggTypeName: et.name,
      onHandEach: (lotMap.get(et.id) ?? 0) + (adjMap.get(et.id) ?? 0),
    }));

    res.json(onHand);
  },
);

// ─── Allocate Eggs (FIFO) ─────────────────────────────────────────────────────

router.post(
  "/admin/orders/:orderId/allocate-eggs",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const parsed = AdminAllocateEggsParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { orderId } = parsed.data;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const allItems = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, orderId));

    if (allItems.length === 0) {
      res.json({ allocations: [] });
      return;
    }

    // Identify egg items by looking up each item's product type
    const productIds = [
      ...new Set(
        allItems
          .map((i) => i.productId)
          .filter((id): id is number => id != null),
      ),
    ];

    const products =
      productIds.length > 0
        ? await db
            .select()
            .from(productsTable)
            .where(inArray(productsTable.id, productIds))
        : [];

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Egg items: product_type starts with "eggs_"
    const eggItems = allItems.filter((item) => {
      if (!item.productId) return false;
      const product = productMap.get(item.productId);
      return product?.productType.startsWith("eggs_") ?? false;
    });

    if (eggItems.length === 0) {
      res.json({ allocations: [] });
      return;
    }

    // Idempotency: if any allocation rows exist for these order items, 409
    const eggItemIds = eggItems.map((i) => i.id);
    const existingAllocations = await db
      .select({
        id: inventoryAllocationsTable.id,
        orderItemId: inventoryAllocationsTable.orderItemId,
        lotId: inventoryAllocationsTable.lotId,
        allocatedQtyEach: inventoryAllocationsTable.allocatedQtyEach,
        allocatedAt: inventoryAllocationsTable.allocatedAt,
        lotDate: eggInventoryLotsTable.lotDate,
        eggTypeName: eggTypesTable.name,
      })
      .from(inventoryAllocationsTable)
      .innerJoin(
        eggInventoryLotsTable,
        eq(inventoryAllocationsTable.lotId, eggInventoryLotsTable.id),
      )
      .innerJoin(
        eggTypesTable,
        eq(eggInventoryLotsTable.eggTypeId, eggTypesTable.id),
      )
      .where(inArray(inventoryAllocationsTable.orderItemId, eggItemIds));

    if (existingAllocations.length > 0) {
      res.status(409).json({
        message: "Already allocated",
        allocations: existingAllocations,
      });
      return;
    }

    // Get all active egg types
    const activeEggTypes = await db
      .select()
      .from(eggTypesTable)
      .where(eq(eggTypesTable.active, true));

    if (activeEggTypes.length === 0) {
      res.status(400).json({ error: "No active egg types found" });
      return;
    }

    // FIFO allocation in a single transaction
    try {
      const newAllocations = await db.transaction(async (tx) => {
        const allInserted: {
          id: number;
          orderItemId: number;
          lotId: number;
          allocatedQtyEach: number;
          allocatedAt: Date;
          lotDate: string;
          eggTypeName: string;
        }[] = [];

        for (const item of eggItems) {
          // Match egg type: prefer name match against product name, fall back to first active
          const product = productMap.get(item.productId!);
          const productNameLower =
            product?.name.toLowerCase().replace(/eggs?/gi, "").trim() ?? "";
          const eggType =
            activeEggTypes.find((et) =>
              et.name.toLowerCase().includes(productNameLower),
            ) ?? activeEggTypes[0];

          const required = item.quantity;

          // Fetch lots FIFO with row lock
          const lots = await tx
            .select()
            .from(eggInventoryLotsTable)
            .where(
              and(
                eq(eggInventoryLotsTable.eggTypeId, eggType.id),
                sql`${eggInventoryLotsTable.status} != 'depleted'`,
                sql`${eggInventoryLotsTable.remainingQtyEach} > 0`,
              ),
            )
            .orderBy(asc(eggInventoryLotsTable.lotDate))
            .for("update");

          const totalAvailable = lots.reduce(
            (s, l) => s + l.remainingQtyEach,
            0,
          );

          if (totalAvailable < required) {
            throw Object.assign(
              new Error(
                `Insufficient inventory for ${eggType.name}: need ${required}, have ${totalAvailable}`,
              ),
              { status: 400 },
            );
          }

          let remaining = required;
          for (const lot of lots) {
            if (remaining <= 0) break;
            const take = Math.min(lot.remainingQtyEach, remaining);
            remaining -= take;
            const newRemaining = lot.remainingQtyEach - take;

            await tx
              .update(eggInventoryLotsTable)
              .set({
                remainingQtyEach: newRemaining,
                status: newRemaining === 0 ? "depleted" : "open",
              })
              .where(eq(eggInventoryLotsTable.id, lot.id));

            const [inserted] = await tx
              .insert(inventoryAllocationsTable)
              .values({
                orderItemId: item.id,
                lotId: lot.id,
                allocatedQtyEach: take,
              })
              .returning();

            allInserted.push({
              ...inserted,
              lotDate: lot.lotDate,
              eggTypeName: eggType.name,
            });
          }
        }

        return allInserted;
      });

      res.json({ allocations: newAllocations });
    } catch (err: unknown) {
      const httpErr = err as { status?: number; message?: string };
      if (httpErr.status) {
        res.status(httpErr.status).json({ error: httpErr.message });
        return;
      }
      throw err;
    }
  },
);

// ─── Get Egg Allocations for Order ───────────────────────────────────────────

router.get(
  "/admin/orders/:orderId/egg-allocations",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const parsed = AdminGetEggAllocationsParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { orderId } = parsed.data;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const allocations = await db
      .select({
        id: inventoryAllocationsTable.id,
        orderItemId: inventoryAllocationsTable.orderItemId,
        lotId: inventoryAllocationsTable.lotId,
        allocatedQtyEach: inventoryAllocationsTable.allocatedQtyEach,
        allocatedAt: inventoryAllocationsTable.allocatedAt,
        lotDate: eggInventoryLotsTable.lotDate,
        eggTypeName: eggTypesTable.name,
      })
      .from(inventoryAllocationsTable)
      .innerJoin(
        orderItemsTable,
        eq(inventoryAllocationsTable.orderItemId, orderItemsTable.id),
      )
      .innerJoin(
        eggInventoryLotsTable,
        eq(inventoryAllocationsTable.lotId, eggInventoryLotsTable.id),
      )
      .innerJoin(
        eggTypesTable,
        eq(eggInventoryLotsTable.eggTypeId, eggTypesTable.id),
      )
      .where(eq(orderItemsTable.orderId, orderId));

    res.json(allocations);
  },
);

export default router;
