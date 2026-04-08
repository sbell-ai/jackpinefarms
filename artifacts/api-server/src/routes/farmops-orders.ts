import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, ordersTable, orderItemsTable, orderEventsTable } from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";

const router: IRouter = Router();

const listQuery = z.object({
  status: z.string().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

router.get("/farmops/orders", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { status } = parsed.data;

  const whereClause = status
    ? and(
        eq(ordersTable.tenantId, tenantId),
        eq(ordersTable.status, status as typeof ordersTable.$inferSelect.status)
      )
    : eq(ordersTable.tenantId, tenantId);

  const orders = await db
    .select({
      id: ordersTable.id,
      customerName: ordersTable.customerName,
      customerEmail: ordersTable.customerEmail,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      source: ordersTable.source,
      totalInCents: ordersTable.totalInCents,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(whereClause)
    .orderBy(desc(ordersTable.createdAt));

  res.json(orders);
});

router.get("/farmops/orders/:id", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  const { id } = parsed.data;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [items, events] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db
      .select()
      .from(orderEventsTable)
      .where(eq(orderEventsTable.orderId, id))
      .orderBy(desc(orderEventsTable.createdAt)),
  ]);

  res.json({ ...order, items, events });
});

export default router;
