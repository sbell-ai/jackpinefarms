import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { desc, eq, and, SQL } from "drizzle-orm";
import { db, ordersTable, orderEventsTable, orderItemsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";
import { AdminListOrdersQueryParams, AdminGetOrderParams } from "@workspace/api-zod";
import { getOrderWithItems } from "./orders.js";
import * as z from "zod";

const router: IRouter = Router();

const UpdateStatusBody = z.object({
  status: z.enum([
    "pending_payment", "deposit_paid", "cash_pending", "pickup_assigned",
    "weights_entered", "invoice_sent", "fulfilled", "cancelled", "no_show"
  ]),
  note: z.string().optional(),
});

const AddNoteBody = z.object({
  body: z.string().min(1),
});

const AssignBatchBody = z.object({
  batchId: z.number().int().positive().nullable(),
});

router.get("/admin/orders", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit ?? 50;
  const offset = parsed.data.offset ?? 0;
  const statusFilter = parsed.data.status;

  const conditions: SQL[] = [];
  if (statusFilter) {
    conditions.push(eq(ordersTable.status, statusFilter));
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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
      refundedGiblets: o.refundedGiblets,
      batchId: o.batchId,
      pickupEventId: o.pickupEventId,
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

router.patch("/admin/orders/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  await db.update(ordersTable).set({ status: parsed.data.status }).where(eq(ordersTable.id, id));

  const noteBody = parsed.data.note
    ? `Status changed from ${existing.status} to ${parsed.data.status}. Note: ${parsed.data.note}`
    : `Status changed from ${existing.status} to ${parsed.data.status}`;

  await db.insert(orderEventsTable).values({ orderId: id, eventType: "status_change", body: noteBody });

  const order = await getOrderWithItems(id);
  res.json(order);
});

router.post("/admin/orders/:id/refund-giblets", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (order.refundedGiblets) {
    res.status(400).json({ error: "Giblets already refunded for this order" });
    return;
  }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  const hasGiblets = items.some((item) => item.isGiblets);
  if (!hasGiblets) {
    res.status(400).json({ error: "This order does not include giblets" });
    return;
  }

  await db.update(ordersTable).set({ refundedGiblets: true }).where(eq(ordersTable.id, id));

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const paymentIntentId = order.stripePaymentIntentId;

  if (stripeKey && paymentIntentId) {
    try {
      const Stripe = require("stripe");
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: 200,
        reason: "requested_by_customer",
      });
      await db.update(ordersTable).set({ stripeRefundId: refund.id }).where(eq(ordersTable.id, id));
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "refund",
        body: `Giblets refund of $2.00 processed via Stripe (refund id: ${refund.id})`,
      });
      res.json({ message: "Giblets refunded via Stripe ($2.00)" });
    } catch (err: any) {
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "refund",
        body: `Giblets refund of $2.00 attempted via Stripe but failed: ${err.message}`,
      });
      res.status(500).json({ error: `Stripe refund failed: ${err.message}` });
    }
  } else {
    await db.insert(orderEventsTable).values({
      orderId: id,
      eventType: "refund",
      body: "[REFUND STUB] Giblets refund of $2.00 marked. Configure Stripe to process real refunds.",
    });
    console.log(`[REFUND STUB] Order ${id} — giblets refund of $2.00 for ${order.customerEmail}`);
    res.json({ message: "Giblets refund recorded (stub — configure Stripe to process real refunds)" });
  }
});

router.post("/admin/orders/:id/notes", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AddNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [order] = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [event] = await db
    .insert(orderEventsTable)
    .values({ orderId: id, eventType: "note", body: parsed.data.body })
    .returning();

  res.status(201).json(event);
});

router.get("/admin/orders/:id/events", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const events = await db
    .select()
    .from(orderEventsTable)
    .where(eq(orderEventsTable.orderId, id))
    .orderBy(orderEventsTable.createdAt);

  res.json(events);
});

router.patch("/admin/orders/:id/assign-batch", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AssignBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  await db.update(ordersTable).set({ batchId: parsed.data.batchId }).where(eq(ordersTable.id, id));

  const order = await getOrderWithItems(id);
  res.json(order);
});

export default router;
