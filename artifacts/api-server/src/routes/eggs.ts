import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  eggTypesTable,
  eggInventoryLotsTable,
  inventoryAllocationsTable,
  ordersTable,
  orderItemsTable,
  productsTable,
} from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/require-platform-admin.js";
import {
  AdminAllocateEggsParams,
  AdminGetEggAllocationsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Allocate Eggs to Order (FIFO) ───────────────────────────────────────────
//
// These routes operate on Jack Pine Farm customer orders (storefront), not on
// FarmOps tenant data, so they remain platform-admin-only.

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
