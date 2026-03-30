import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { desc, eq, and, SQL, sql } from "drizzle-orm";
import { db, ordersTable, orderEventsTable, orderItemsTable, preorderBatchesTable, couponsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";
import { AdminListOrdersQueryParams, AdminGetOrderParams } from "@workspace/api-zod";
import { getOrderWithItems } from "./orders.js";
import { createStripeInvoice } from "../lib/stripe-invoice.js";
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

  // Increment coupon redemption only on the first transition to fulfilled for cash orders
  const appliedCode = (existing as { appliedCouponCode?: string | null }).appliedCouponCode;
  if (
    parsed.data.status === "fulfilled" &&
    existing.status !== "fulfilled" &&
    existing.paymentMethod === "cash" &&
    appliedCode
  ) {
    db.update(couponsTable)
      .set({ redemptionsCount: sql`${couponsTable.redemptionsCount} + 1` })
      .where(eq(couponsTable.code, appliedCode))
      .catch((err: unknown) => console.warn("[admin-orders] Coupon redemption increment failed:", err));
  }

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
  const gibletItems = items.filter((item) => item.isGiblets);
  if (gibletItems.length === 0) {
    res.status(400).json({ error: "This order does not include giblets" });
    return;
  }

  const gibletRefundCents = gibletItems.reduce((sum, item) => sum + item.unitPriceInCents * item.quantity, 0);
  const gibletRefundDollars = (gibletRefundCents / 100).toFixed(2);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const paymentIntentId = order.stripePaymentIntentId;

  if (stripeKey && paymentIntentId) {
    try {
      const Stripe = require("stripe");
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: gibletRefundCents,
        reason: "requested_by_customer",
      });
      await db.update(ordersTable)
        .set({ refundedGiblets: true, stripeRefundId: refund.id })
        .where(eq(ordersTable.id, id));
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "refund",
        body: `Giblets refund of $${gibletRefundDollars} processed via Stripe (refund id: ${refund.id})`,
      });
      res.json({ message: `Giblets refunded via Stripe ($${gibletRefundDollars})` });
    } catch (err: any) {
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "refund",
        body: `Giblets refund of $${gibletRefundDollars} attempted via Stripe but failed: ${err.message}. Retry this refund when the issue is resolved.`,
      });
      res.status(500).json({ error: `Stripe refund failed: ${err.message}` });
    }
  } else {
    await db.update(ordersTable).set({ refundedGiblets: true }).where(eq(ordersTable.id, id));
    await db.insert(orderEventsTable).values({
      orderId: id,
      eventType: "refund",
      body: `[REFUND STUB] Giblets refund of $${gibletRefundDollars} marked. Configure STRIPE_SECRET_KEY to process real refunds.`,
    });
    console.log(`[REFUND STUB] Order ${id} — giblets refund of $${gibletRefundDollars} for ${order.customerEmail}`);
    res.json({ message: `Giblets refund recorded (configure Stripe to process real refunds)` });
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

const SendOrderInvoiceBody = z.object({
  weightLbs: z.number().positive(),
  variant: z.enum(["whole", "half", "quarter"]).default("whole"),
});

router.post("/admin/orders/:id/send-invoice", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SendOrderInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { weightLbs, variant } = parsed.data;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (!order.batchId) {
    res.status(400).json({ error: "Order is not assigned to a preorder batch. Assign a batch before invoicing." });
    return;
  }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  const depositItems = items.filter((i) => i.pricingType === "deposit");
  const depositPaidCents = depositItems.reduce((s, i) => s + i.lineTotalInCents, 0);

  const [batch] = await db.select().from(preorderBatchesTable).where(eq(preorderBatchesTable.id, order.batchId)).limit(1);
  if (!batch) { res.status(404).json({ error: "Preorder batch not found" }); return; }

  const pricePerLbCents =
    variant === "half" ? batch.pricePerLbCentsHalf :
    variant === "quarter" ? batch.pricePerLbCentsQuarter :
    batch.pricePerLbCentsWhole;

  const finalTotalCents = Math.round(weightLbs * pricePerLbCents);
  const remainingCents = Math.max(0, finalTotalCents - depositPaidCents);

  await db.update(ordersTable)
    .set({ finalWeightLbs: weightLbs })
    .where(eq(ordersTable.id, id));

  if (remainingCents === 0) {
    await db.update(ordersTable).set({ status: "invoice_sent" }).where(eq(ordersTable.id, id));
    await db.insert(orderEventsTable).values({
      orderId: id,
      eventType: "invoice_sent",
      body: `No additional charge: deposit covers full balance. Weight: ${weightLbs} lbs × $${(pricePerLbCents / 100).toFixed(2)}/lb = $${(finalTotalCents / 100).toFixed(2)}. Deposit paid: $${(depositPaidCents / 100).toFixed(2)}.`,
    });
    res.json({ status: "deposit_covers_balance", remainingCents: 0, finalTotalCents, depositPaidCents });
    return;
  }

  try {
    const invoiceId = await createStripeInvoice({
      orderId: id,
      email: order.customerEmail,
      customerName: order.customerName,
      remainingCents,
      weightLbs,
      pricePerLbCents,
      depositPaidCents,
      eventName: batch.name,
    });

    if (invoiceId) {
      await db.update(ordersTable)
        .set({ stripeInvoiceId: invoiceId, status: "invoice_sent" })
        .where(eq(ordersTable.id, id));
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "invoice_sent",
        body: `Stripe invoice ${invoiceId} sent to ${order.customerEmail}. Remaining: $${(remainingCents / 100).toFixed(2)} (${weightLbs} lbs × $${(pricePerLbCents / 100).toFixed(2)}/lb − $${(depositPaidCents / 100).toFixed(2)} deposit).`,
      });
      res.json({ status: "invoiced", remainingCents, finalTotalCents, depositPaidCents, invoiceId });
    } else {
      await db.update(ordersTable).set({ status: "invoice_sent" }).where(eq(ordersTable.id, id));
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "invoice_sent",
        body: `[STUB] Invoice queued for ${order.customerEmail}. Remaining: $${(remainingCents / 100).toFixed(2)} (${weightLbs} lbs × $${(pricePerLbCents / 100).toFixed(2)}/lb − $${(depositPaidCents / 100).toFixed(2)} deposit). Configure STRIPE_SECRET_KEY to send real invoices.`,
      });
      console.log(
        `[INVOICE STUB] Order ${id} — ${order.customerEmail}\n` +
        `  Weight: ${weightLbs} lbs (${variant}, ${batch.name})\n` +
        `  Final: $${(finalTotalCents / 100).toFixed(2)} | Deposit: $${(depositPaidCents / 100).toFixed(2)} | Remaining: $${(remainingCents / 100).toFixed(2)}`
      );
      res.json({ status: "stub", remainingCents, finalTotalCents, depositPaidCents });
    }
  } catch (err: any) {
    await db.insert(orderEventsTable).values({
      orderId: id,
      eventType: "invoice_sent",
      body: `Stripe invoice failed for ${order.customerEmail}: ${err.message}. Remaining: $${(remainingCents / 100).toFixed(2)}.`,
    });
    res.status(500).json({ error: `Stripe invoice failed: ${err.message}` });
  }
});

export default router;
