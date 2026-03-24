import { Router, type IRouter } from "express";
import { desc, count } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";
import { AdminListOrdersQueryParams, AdminGetOrderParams } from "@workspace/api-zod";
import { getOrderWithItems } from "./orders.js";

const router: IRouter = Router();

router.get("/admin/orders", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit ?? 50;
  const offset = parsed.data.offset ?? 0;

  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(
    orders.map((o) => ({
      id: o.id,
      status: o.status,
      paymentMethod: o.paymentMethod,
      totalInCents: o.totalInCents,
      createdAt: o.createdAt,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
    }))
  );
});

router.get("/admin/orders/:id", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminGetOrderParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const order = await getOrderWithItems(parsed.data.id);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(order);
});

export default router;
