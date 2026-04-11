import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  ordersTable,
  orderItemsTable,
  orderEventsTable,
  preorderBatchesTable,
  couponsTable,
} from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";
import { getOrderWithItems } from "./orders.js";
import { buildOrderItems } from "./checkout.js";
import { createStripeInvoice } from "../lib/stripe-invoice.js";
import { sendSms } from "../lib/sms.js";

const router: IRouter = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const listQuery = z.object({
  status: z.string().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

const UpdateStatusBody = z.object({
  status: z.enum([
    "pending_payment", "deposit_paid", "cash_pending", "pickup_assigned",
    "weights_entered", "invoice_sent", "fulfilled", "cancelled", "no_show",
  ]),
  note: z.string().optional(),
});

const AddNoteBody = z.object({
  body: z.string().min(1),
});

const AssignBatchBody = z.object({
  batchId: z.number().int().positive().nullable(),
});

const SetOrderItemsBody = z.array(z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
}));

const SendOrderInvoiceBody = z.object({
  weightLbs: z.number().positive(),
  variant: z.enum(["whole", "half", "quarter"]).default("whole"),
});

const UpdateOrderBody = z.object({
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  notes: z.string().nullable().optional(),
  pickupEventId: z.number().int().positive().nullable().optional(),
});

const RefundBody = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().optional(),
});

// ─── Stripe helper ────────────────────────────────────────────────────────────

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

// ─── GET /farmops/orders ──────────────────────────────────────────────────────

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

// ─── GET /farmops/orders/:id ──────────────────────────────────────────────────

router.get("/farmops/orders/:id", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  const { id } = parsed.data;

  // Ownership check first; then use getOrderWithItems for full response including
  // pickupEventName / pickupEventScheduledAt.
  const [owned] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
    .limit(1);

  if (!owned) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const order = await getOrderWithItems(id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const events = await db
    .select()
    .from(orderEventsTable)
    .where(eq(orderEventsTable.orderId, id))
    .orderBy(desc(orderEventsTable.createdAt));

  res.json({ ...order, events });
});

// ─── GET /farmops/batches ─────────────────────────────────────────────────────

router.get("/farmops/batches", requireFarmopsTenant, async (req, res): Promise<void> => {
  const batches = await db
    .select({
      id: preorderBatchesTable.id,
      name: preorderBatchesTable.name,
      status: preorderBatchesTable.status,
      pricePerLbCentsWhole: preorderBatchesTable.pricePerLbCentsWhole,
      pricePerLbCentsHalf: preorderBatchesTable.pricePerLbCentsHalf,
      pricePerLbCentsQuarter: preorderBatchesTable.pricePerLbCentsQuarter,
    })
    .from(preorderBatchesTable)
    .orderBy(desc(preorderBatchesTable.id));

  res.json(batches);
});

// ─── PATCH /farmops/orders/:id/status ────────────────────────────────────────

router.patch(
  "/farmops/orders/:id/status",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = UpdateStatusBody.safeParse(req.body);
    if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

    const [existing] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    await db.update(ordersTable).set({ status: bodyParsed.data.status }).where(eq(ordersTable.id, id));

    // Increment coupon redemption on first transition to fulfilled for cash orders
    const appliedCode = existing.appliedCouponCode;
    if (
      bodyParsed.data.status === "fulfilled" &&
      existing.status !== "fulfilled" &&
      existing.paymentMethod === "cash" &&
      appliedCode
    ) {
      db.update(couponsTable)
        .set({ redemptionsCount: sql`${couponsTable.redemptionsCount} + 1` })
        .where(eq(couponsTable.code, appliedCode))
        .catch((err: unknown) => console.warn("[farmops-orders] Coupon redemption increment failed:", err));
    }

    const noteBody = bodyParsed.data.note
      ? `Status changed from ${existing.status} to ${bodyParsed.data.status}. Note: ${bodyParsed.data.note}`
      : `Status changed from ${existing.status} to ${bodyParsed.data.status}`;

    await db.insert(orderEventsTable).values({ orderId: id, eventType: "status_change", body: noteBody });

    // Customer SMS notification (fire-and-forget)
    const storeBaseUrl = process.env.STORE_BASE_URL ?? "";
    const orderUrl = `${storeBaseUrl}/account/orders/${id}`;
    const farmName = req.farmopsTenant!.name;
    const SMS_MESSAGES: Partial<Record<string, string>> = {
      pickup_assigned: `Your order #${id} has been assigned to a pickup event. View details: ${orderUrl} – ${farmName}`,
      invoice_sent:    `Your invoice for order #${id} is ready. View details: ${orderUrl} – ${farmName}`,
      fulfilled:       `Your order #${id} has been fulfilled. Thank you! View details: ${orderUrl} – ${farmName}`,
      cancelled:       `Your order #${id} has been cancelled. Please contact us if you have questions. – ${farmName}`,
    };
    const smsBody = SMS_MESSAGES[bodyParsed.data.status];
    if (smsBody && existing.customerPhone) {
      sendSms({ to: existing.customerPhone, body: smsBody })
        .catch((err: unknown) => console.warn("[farmops-orders] Customer SMS failed:", err));
    }

    const order = await getOrderWithItems(id);
    res.json(order);
  }
);

// ─── PATCH /farmops/orders/:id  (edit customer details) ──────────────────────

router.patch(
  "/farmops/orders/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = UpdateOrderBody.safeParse(req.body);
    if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

    const [existing] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    const updates: Partial<typeof ordersTable.$inferInsert> = {};
    if (bodyParsed.data.customerName !== undefined) updates.customerName = bodyParsed.data.customerName;
    if (bodyParsed.data.customerEmail !== undefined) updates.customerEmail = bodyParsed.data.customerEmail;
    if (bodyParsed.data.customerPhone !== undefined) updates.customerPhone = bodyParsed.data.customerPhone;
    if (bodyParsed.data.notes !== undefined) updates.notes = bodyParsed.data.notes;
    if (bodyParsed.data.pickupEventId !== undefined) updates.pickupEventId = bodyParsed.data.pickupEventId;

    if (Object.keys(updates).length > 0) {
      await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id));
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "note",
        body: "Order details updated.",
      });
    }

    const order = await getOrderWithItems(id);
    res.json(order);
  }
);

// ─── PATCH /farmops/orders/:id/items ─────────────────────────────────────────

router.patch(
  "/farmops/orders/:id/items",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = SetOrderItemsBody.safeParse(req.body);
    if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

    const [existing] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));

    if (bodyParsed.data.length > 0) {
      const cart = bodyParsed.data.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        addGiblets: false,
      }));

      const orderData = await buildOrderItems(cart);
      if (!orderData) {
        res.status(400).json({ error: "Could not price items — check product IDs" });
        return;
      }

      await db.insert(orderItemsTable).values(
        orderData.lineItems.map((li) => ({
          orderId: id,
          productId: li.productId,
          productName: li.productName,
          quantity: li.quantity,
          pricingType: li.pricingType,
          unitPriceInCents: li.unitPriceInCents,
          unitLabel: li.unitLabel,
          isGiblets: li.isGiblets,
          lineTotalInCents: li.lineTotalInCents,
        }))
      );

      await db.update(ordersTable)
        .set({ totalInCents: orderData.totalInCents })
        .where(eq(ordersTable.id, id));
    } else {
      await db.update(ordersTable)
        .set({ totalInCents: 0 })
        .where(eq(ordersTable.id, id));
    }

    const order = await getOrderWithItems(id);
    res.json(order);
  }
);

// ─── POST /farmops/orders/:id/notes ──────────────────────────────────────────

router.post(
  "/farmops/orders/:id/notes",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = AddNoteBody.safeParse(req.body);
    if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

    const [existing] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    const [event] = await db
      .insert(orderEventsTable)
      .values({ orderId: id, eventType: "note", body: bodyParsed.data.body })
      .returning();

    res.status(201).json(event);
  }
);

// ─── PATCH /farmops/orders/:id/assign-batch ───────────────────────────────────

router.patch(
  "/farmops/orders/:id/assign-batch",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = AssignBatchBody.safeParse(req.body);
    if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

    const [existing] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    await db.update(ordersTable)
      .set({ batchId: bodyParsed.data.batchId })
      .where(eq(ordersTable.id, id));

    const order = await getOrderWithItems(id);
    res.json(order);
  }
);

// ─── POST /farmops/orders/:id/send-invoice ────────────────────────────────────

router.post(
  "/farmops/orders/:id/send-invoice",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = SendOrderInvoiceBody.safeParse(req.body);
    if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

    const { weightLbs, variant } = bodyParsed.data;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (!order.batchId) {
      res.status(400).json({ error: "Order is not assigned to a preorder batch. Assign a batch before invoicing." });
      return;
    }

    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    const depositItems = items.filter((i) => i.pricingType === "deposit");
    const depositPaidCents = depositItems.reduce((s, i) => s + i.lineTotalInCents, 0);

    const [batch] = await db
      .select()
      .from(preorderBatchesTable)
      .where(eq(preorderBatchesTable.id, order.batchId))
      .limit(1);
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "invoice_sent",
        body: `Stripe invoice failed for ${order.customerEmail}: ${errMsg}. Remaining: $${(remainingCents / 100).toFixed(2)}.`,
      });
      res.status(500).json({ error: `Stripe invoice failed: ${errMsg}` });
    }
  }
);

// ─── POST /farmops/orders/:id/refund ─────────────────────────────────────────

router.post(
  "/farmops/orders/:id/refund",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = RefundBody.safeParse(req.body);
    if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const { amountCents, reason } = bodyParsed.data;
    const amountDollars = (amountCents / 100).toFixed(2);
    const reasonText = reason ? ` — ${reason}` : "";

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const paymentIntentId = order.stripePaymentIntentId;

    if (stripeKey && paymentIntentId) {
      try {
        const stripe = getStripe()!;
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: amountCents,
          reason: "requested_by_customer",
        });
        await db.insert(orderEventsTable).values({
          orderId: id,
          eventType: "refund",
          body: `Refund of $${amountDollars} processed via Stripe (refund id: ${refund.id})${reasonText}.`,
        });
        res.json({ message: `Refund of $${amountDollars} processed via Stripe.` });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await db.insert(orderEventsTable).values({
          orderId: id,
          eventType: "refund",
          body: `Refund of $${amountDollars} failed: ${errMsg}${reasonText}.`,
        });
        res.status(500).json({ error: `Stripe refund failed: ${errMsg}` });
      }
    } else {
      await db.insert(orderEventsTable).values({
        orderId: id,
        eventType: "refund",
        body: `[REFUND STUB] Refund of $${amountDollars} recorded${reasonText}. Configure STRIPE_SECRET_KEY to process real refunds.`,
      });
      console.log(`[REFUND STUB] Order ${id} — refund of $${amountDollars}${reasonText}`);
      res.json({ message: `Refund of $${amountDollars} recorded (configure Stripe to process real refunds).` });
    }
  }
);

// ─── POST /farmops/orders/:id/refund-giblets ──────────────────────────────────

router.post(
  "/farmops/orders/:id/refund-giblets",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
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
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await db.insert(orderEventsTable).values({
          orderId: id,
          eventType: "refund",
          body: `Giblets refund of $${gibletRefundDollars} attempted via Stripe but failed: ${errMsg}. Retry this refund when the issue is resolved.`,
        });
        res.status(500).json({ error: `Stripe refund failed: ${errMsg}` });
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
  }
);

// ─── DELETE /farmops/orders/:id ───────────────────────────────────────────────

router.delete(
  "/farmops/orders/:id",
  requireFarmopsTenant,
  requireFarmopsRole("owner"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const { id } = parsed.data;

    const [existing] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    await db.delete(ordersTable).where(eq(ordersTable.id, id));

    res.json({ message: "Order deleted" });
  }
);

export default router;
