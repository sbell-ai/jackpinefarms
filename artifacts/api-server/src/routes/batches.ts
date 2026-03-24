import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, count, inArray } from "drizzle-orm";
import { db, preorderBatchesTable, ordersTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";
import * as z from "zod";

const router: IRouter = Router();

const CreateBatchBody = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(1),
  status: z.enum(["open", "closed", "complete"]).optional().default("open"),
  capacityBirds: z.number().int().positive(),
  pricePerLbCentsWhole: z.number().int().positive(),
  pricePerLbCentsHalf: z.number().int().positive(),
  pricePerLbCentsQuarter: z.number().int().positive(),
  notes: z.string().nullable().optional(),
});

const UpdateBatchBody = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["open", "closed", "complete"]).optional(),
  capacityBirds: z.number().int().positive().optional(),
  pricePerLbCentsWhole: z.number().int().positive().optional(),
  pricePerLbCentsHalf: z.number().int().positive().optional(),
  pricePerLbCentsQuarter: z.number().int().positive().optional(),
  notes: z.string().nullable().optional(),
});

async function getBatchWithCount(batchId: number) {
  const [batch] = await db
    .select()
    .from(preorderBatchesTable)
    .where(eq(preorderBatchesTable.id, batchId))
    .limit(1);

  if (!batch) return null;

  const [{ value: orderCount }] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(eq(ordersTable.batchId, batchId));

  return { ...batch, orderCount: Number(orderCount) };
}

router.get("/admin/batches", requireAdmin, async (req, res): Promise<void> => {
  const batches = await db
    .select({
      id: preorderBatchesTable.id,
      productId: preorderBatchesTable.productId,
      name: preorderBatchesTable.name,
      status: preorderBatchesTable.status,
      capacityBirds: preorderBatchesTable.capacityBirds,
      pricePerLbCentsWhole: preorderBatchesTable.pricePerLbCentsWhole,
      pricePerLbCentsHalf: preorderBatchesTable.pricePerLbCentsHalf,
      pricePerLbCentsQuarter: preorderBatchesTable.pricePerLbCentsQuarter,
      notes: preorderBatchesTable.notes,
      createdAt: preorderBatchesTable.createdAt,
      updatedAt: preorderBatchesTable.updatedAt,
    })
    .from(preorderBatchesTable)
    .orderBy(preorderBatchesTable.createdAt);

  const batchIds = batches.map((b) => b.id);
  const orderCounts = batchIds.length > 0
    ? await db
        .select({ batchId: ordersTable.batchId, value: count() })
        .from(ordersTable)
        .where(inArray(ordersTable.batchId, batchIds))
        .groupBy(ordersTable.batchId)
    : [];

  const countMap = new Map(orderCounts.map((r) => [r.batchId, Number(r.value)]));

  res.json(batches.map((b) => ({ ...b, orderCount: countMap.get(b.id) ?? 0 })));
});

router.get("/admin/batches/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const batch = await getBatchWithCount(id);
  if (!batch) { res.status(404).json({ error: "Batch not found" }); return; }

  res.json(batch);
});

router.post("/admin/batches", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [batch] = await db
    .insert(preorderBatchesTable)
    .values(parsed.data)
    .returning();

  res.status(201).json({ ...batch, orderCount: 0 });
});

router.patch("/admin/batches/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(preorderBatchesTable)
    .set(parsed.data)
    .where(eq(preorderBatchesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Batch not found" }); return; }

  const batch = await getBatchWithCount(id);
  res.json(batch);
});

export default router;
