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
  insertFlockSchema,
  insertFlockEventSchema,
  insertAnimalSchema,
  insertEggTypeSchema,
  insertDailyEggCollectionSchema,
  insertEggInventoryAdjustmentSchema,
} from "@workspace/db";
import {
  requireFarmopsTenant,
} from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";

const router: IRouter = Router();

// Local query schemas (orval generates zod.date() which rejects JSON strings)
const dateRangeQuery = z.object({
  eggTypeId: z.coerce.number().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns all egg type IDs belonging to this tenant.
 * Used to scope tables that have no direct tenantId column.
 */
async function getTenantEggTypeIds(tenantId: number): Promise<number[]> {
  const rows = await db
    .select({ id: eggTypesTable.id })
    .from(eggTypesTable)
    .where(eq(eggTypesTable.tenantId, tenantId));
  return rows.map((r) => r.id);
}

// ─── Flocks ───────────────────────────────────────────────────────────────────

router.get("/farmops/flocks", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;
  const flocks = await db
    .select()
    .from(flocksTable)
    .where(eq(flocksTable.tenantId, tenantId))
    .orderBy(flocksTable.name);
  res.json(flocks);
});

router.post(
  "/farmops/flocks",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    // tenantId from session always wins — spread body first, then override
    const parsed = insertFlockSchema.safeParse({ ...req.body, tenantId });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [flock] = await db.insert(flocksTable).values(parsed.data).returning();
    res.status(201).json(flock);
  },
);

router.put(
  "/farmops/flocks/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid flock id" }); return; }
    const parsed = insertFlockSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const [updated] = await db
      .update(flocksTable)
      .set(parsed.data)
      .where(and(eq(flocksTable.id, id), eq(flocksTable.tenantId, tenantId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Flock not found" }); return; }
    res.json(updated);
  },
);

// ─── Flock Events ─────────────────────────────────────────────────────────────

router.get(
  "/farmops/flocks/:id/events",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const flockId = parseInt(String(req.params.id), 10);
    if (isNaN(flockId)) { res.status(400).json({ error: "Invalid flock id" }); return; }

    // Verify flock belongs to this tenant
    const [flock] = await db
      .select({ id: flocksTable.id })
      .from(flocksTable)
      .where(and(eq(flocksTable.id, flockId), eq(flocksTable.tenantId, tenantId)));
    if (!flock) { res.status(404).json({ error: "Flock not found" }); return; }

    const events = await db
      .select()
      .from(flockEventsTable)
      .where(eq(flockEventsTable.flockId, flockId))
      .orderBy(asc(flockEventsTable.eventDate));
    res.json(events);
  },
);

router.post(
  "/farmops/flocks/:id/events",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const flockId = parseInt(String(req.params.id), 10);
    if (isNaN(flockId)) { res.status(400).json({ error: "Invalid flock id" }); return; }

    // Verify flock belongs to this tenant
    const [flock] = await db
      .select({ id: flocksTable.id })
      .from(flocksTable)
      .where(and(eq(flocksTable.id, flockId), eq(flocksTable.tenantId, tenantId)));
    if (!flock) { res.status(404).json({ error: "Flock not found" }); return; }

    const parsed = insertFlockEventSchema.safeParse({ ...req.body, flockId });
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const [event] = await db.insert(flockEventsTable).values(parsed.data).returning();
    res.status(201).json(event);
  },
);

// ─── Animals ──────────────────────────────────────────────────────────────────

router.get("/farmops/animals", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;
  const flockIdParam = req.query.flockId ? parseInt(String(req.query.flockId), 10) : undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(animalsTable.tenantId, tenantId)];
  if (flockIdParam !== undefined) {
    conditions.push(eq(animalsTable.flockId, flockIdParam));
  }

  const rows = await db
    .select()
    .from(animalsTable)
    .where(and(...conditions))
    .orderBy(asc(animalsTable.createdAt));
  res.json(rows);
});

router.post(
  "/farmops/animals",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;

    // If a flockId is provided, verify that flock belongs to this tenant
    if (req.body.flockId != null) {
      const flockId = parseInt(String(req.body.flockId), 10);
      const [flock] = await db
        .select({ id: flocksTable.id })
        .from(flocksTable)
        .where(and(eq(flocksTable.id, flockId), eq(flocksTable.tenantId, tenantId)));
      if (!flock) { res.status(400).json({ error: "Flock not found" }); return; }
    }

    const parsed = insertAnimalSchema.safeParse({ ...req.body, tenantId });
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const [animal] = await db.insert(animalsTable).values(parsed.data).returning();
    res.status(201).json(animal);
  },
);

// ─── Egg Types ────────────────────────────────────────────────────────────────

router.get(
  "/farmops/egg-types",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const eggTypes = await db
      .select()
      .from(eggTypesTable)
      .where(eq(eggTypesTable.tenantId, tenantId))
      .orderBy(eggTypesTable.name);
    res.json(eggTypes);
  },
);

router.post(
  "/farmops/egg-types",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;

    // If a flockId is provided, verify that flock belongs to this tenant
    if (req.body.flockId != null) {
      const flockId = parseInt(String(req.body.flockId), 10);
      const [flock] = await db
        .select({ id: flocksTable.id })
        .from(flocksTable)
        .where(and(eq(flocksTable.id, flockId), eq(flocksTable.tenantId, tenantId)));
      if (!flock) { res.status(400).json({ error: "Flock not found" }); return; }
    }

    const parsed = insertEggTypeSchema.safeParse({ ...req.body, tenantId });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [eggType] = await db.insert(eggTypesTable).values(parsed.data).returning();
    res.status(201).json(eggType);
  },
);

// ─── Daily Egg Collection ─────────────────────────────────────────────────────

router.get(
  "/farmops/egg-collection",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = dateRangeQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { eggTypeId, fromDate, toDate } = parsed.data;

    // daily_egg_collection has no tenantId — scope via egg type ownership
    const tenantEggTypeIds = await getTenantEggTypeIds(tenantId);
    if (tenantEggTypeIds.length === 0) {
      res.json([]);
      return;
    }

    const conditions = [inArray(dailyEggCollectionTable.eggTypeId, tenantEggTypeIds)];
    if (eggTypeId !== undefined)
      conditions.push(eq(dailyEggCollectionTable.eggTypeId, eggTypeId));
    if (fromDate !== undefined)
      conditions.push(gte(dailyEggCollectionTable.collectionDate, fromDate));
    if (toDate !== undefined)
      conditions.push(lte(dailyEggCollectionTable.collectionDate, toDate));

    const records = await db
      .select()
      .from(dailyEggCollectionTable)
      .where(and(...conditions))
      .orderBy(asc(dailyEggCollectionTable.collectionDate));

    res.json(records);
  },
);

router.post(
  "/farmops/egg-collection",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = insertDailyEggCollectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Verify the egg type belongs to this tenant
    const [eggType] = await db
      .select({ id: eggTypesTable.id })
      .from(eggTypesTable)
      .where(and(eq(eggTypesTable.id, parsed.data.eggTypeId), eq(eggTypesTable.tenantId, tenantId)));
    if (!eggType) {
      res.status(400).json({ error: "Egg type not found" });
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
            tenantId,
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
  "/farmops/egg-adjustments",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = dateRangeQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { eggTypeId, fromDate, toDate } = parsed.data;

    // egg_inventory_adjustments has no tenantId — scope via egg type ownership
    const tenantEggTypeIds = await getTenantEggTypeIds(tenantId);
    if (tenantEggTypeIds.length === 0) {
      res.json([]);
      return;
    }

    const conditions = [inArray(eggInventoryAdjustmentsTable.eggTypeId, tenantEggTypeIds)];
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
      .where(and(...conditions))
      .orderBy(asc(eggInventoryAdjustmentsTable.createdAt));

    res.json(adjustments);
  },
);

router.post(
  "/farmops/egg-adjustments",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = insertEggInventoryAdjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { eggTypeId, lotId, qtyEach, reason } = parsed.data;

    // Verify the egg type belongs to this tenant
    const [eggType] = await db
      .select({ id: eggTypesTable.id })
      .from(eggTypesTable)
      .where(and(eq(eggTypesTable.id, eggTypeId), eq(eggTypesTable.tenantId, tenantId)));
    if (!eggType) {
      res.status(400).json({ error: "Egg type not found" });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        if (lotId != null) {
          const [lot] = await tx
            .select()
            .from(eggInventoryLotsTable)
            .where(and(eq(eggInventoryLotsTable.id, lotId), eq(eggInventoryLotsTable.tenantId, tenantId)));

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
  "/farmops/egg-adjustments/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
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

        // Verify the adjustment's egg type belongs to this tenant
        const [eggType] = await tx
          .select({ id: eggTypesTable.id })
          .from(eggTypesTable)
          .where(and(eq(eggTypesTable.id, existing.eggTypeId), eq(eggTypesTable.tenantId, tenantId)));
        if (!eggType) {
          throw Object.assign(new Error("Adjustment not found"), { status: 404 });
        }

        if (existing.lotId != null) {
          const delta = newQty - existing.qtyEach;
          const [lot] = await tx
            .select()
            .from(eggInventoryLotsTable)
            .where(and(eq(eggInventoryLotsTable.id, existing.lotId), eq(eggInventoryLotsTable.tenantId, tenantId)))
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
  "/farmops/egg-inventory/on-hand",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;

    const tenantEggTypeIds = await getTenantEggTypeIds(tenantId);
    if (tenantEggTypeIds.length === 0) {
      res.json([]);
      return;
    }

    const [eggTypes, lotTotals, adjTotals] = await Promise.all([
      db
        .select()
        .from(eggTypesTable)
        .where(eq(eggTypesTable.tenantId, tenantId)),
      db
        .select({
          eggTypeId: eggInventoryLotsTable.eggTypeId,
          total: sum(eggInventoryLotsTable.remainingQtyEach),
        })
        .from(eggInventoryLotsTable)
        .where(
          and(
            eq(eggInventoryLotsTable.tenantId, tenantId),
            sql`${eggInventoryLotsTable.status} != 'depleted'`,
          ),
        )
        .groupBy(eggInventoryLotsTable.eggTypeId),
      db
        .select({
          eggTypeId: eggInventoryAdjustmentsTable.eggTypeId,
          total: sum(eggInventoryAdjustmentsTable.qtyEach),
        })
        .from(eggInventoryAdjustmentsTable)
        .where(
          and(
            inArray(eggInventoryAdjustmentsTable.eggTypeId, tenantEggTypeIds),
            isNull(eggInventoryAdjustmentsTable.lotId),
          ),
        )
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

export default router;
