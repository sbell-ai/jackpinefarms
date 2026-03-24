import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, count, inArray, isNull, and, not, ne } from "drizzle-orm";
import { db, pickupEventsTable, ordersTable, orderEventsTable, orderItemsTable, preorderBatchesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";
import * as z from "zod";

const router: IRouter = Router();

const CreatePickupEventBody = z.object({
  name: z.string().min(1),
  scheduledAt: z.string().transform((s: string) => new Date(s)),
  locationNotes: z.string().nullable().optional(),
});

const UpdatePickupEventBody = z.object({
  name: z.string().min(1).optional(),
  scheduledAt: z.string().transform((s: string) => new Date(s)).optional(),
  locationNotes: z.string().nullable().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
});

const AssignOrderBody = z.object({
  orderId: z.number().int().positive(),
});

const AssignItemBody = z.object({
  orderItemId: z.number().int().positive(),
});

const WeightEntry = z.object({
  orderId: z.number().int().positive(),
  weightLbs: z.number().positive(),
  variant: z.enum(["whole", "half", "quarter"]).optional().default("whole"),
});

const SendInvoicesBody = z.object({
  weights: z.array(WeightEntry).min(1),
});

async function getEventWithCount(eventId: number) {
  const [event] = await db
    .select()
    .from(pickupEventsTable)
    .where(eq(pickupEventsTable.id, eventId))
    .limit(1);

  if (!event) return null;

  const [{ value: assignedOrderCount }] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(eq(ordersTable.pickupEventId, eventId));

  return { ...event, assignedOrderCount: Number(assignedOrderCount) };
}

async function createStripeInvoice(params: {
  orderId: number;
  email: string;
  customerName: string;
  remainingCents: number;
  weightLbs: number;
  pricePerLbCents: number;
  depositPaidCents: number;
  eventName: string;
}): Promise<string | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;

  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const Stripe = require("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });

  const searchResult = await stripe.customers.list({ email: params.email, limit: 1 });
  const stripeCustomer = searchResult.data[0] ?? await stripe.customers.create({
    email: params.email,
    name: params.customerName,
  });

  const description = [
    `Jack Pine Farm — Order #${String(params.orderId).padStart(4, "0")} final balance`,
    `${params.weightLbs} lbs × $${(params.pricePerLbCents / 100).toFixed(2)}/lb = $${((params.weightLbs * params.pricePerLbCents) / 100).toFixed(2)}`,
    `Minus deposit paid: $${(params.depositPaidCents / 100).toFixed(2)}`,
    `Pickup: ${params.eventName}`,
  ].join(" | ");

  await stripe.invoiceItems.create({
    customer: stripeCustomer.id,
    amount: params.remainingCents,
    currency: "cad",
    description,
  });

  const invoice = await stripe.invoices.create({
    customer: stripeCustomer.id,
    collection_method: "send_invoice",
    days_until_due: 7,
    auto_advance: true,
  });

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(finalizedInvoice.id);

  return finalizedInvoice.id;
}

router.get("/admin/pickup-events", requireAdmin, async (req, res): Promise<void> => {
  const events = await db
    .select()
    .from(pickupEventsTable)
    .orderBy(pickupEventsTable.scheduledAt);

  const eventIds = events.map((e) => e.id);

  let countMap = new Map<number, number>();
  if (eventIds.length > 0) {
    const counts = await db
      .select({ pickupEventId: ordersTable.pickupEventId, value: count() })
      .from(ordersTable)
      .where(inArray(ordersTable.pickupEventId, eventIds))
      .groupBy(ordersTable.pickupEventId);
    countMap = new Map(counts.map((r) => [r.pickupEventId!, Number(r.value)]));
  }

  res.json(events.map((e) => ({ ...e, assignedOrderCount: countMap.get(e.id) ?? 0 })));
});

router.get("/admin/pickup-events/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const event = await getEventWithCount(id);
  if (!event) { res.status(404).json({ error: "Pickup event not found" }); return; }

  const assignedOrders = await db
    .select({
      id: ordersTable.id,
      customerName: ordersTable.customerName,
      customerEmail: ordersTable.customerEmail,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      totalInCents: ordersTable.totalInCents,
      finalWeightLbs: ordersTable.finalWeightLbs,
      stripeInvoiceId: ordersTable.stripeInvoiceId,
      batchId: ordersTable.batchId,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.pickupEventId, id));

  const assignedOrderIds = assignedOrders.map((o) => o.id);

  const allAssignedItems = assignedOrderIds.length > 0
    ? await db
        .select()
        .from(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, assignedOrderIds))
    : [];

  const itemsByOrder = new Map<number, typeof allAssignedItems>();
  for (const item of allAssignedItems) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const ordersWithItems = assignedOrders.map((o) => ({
    ...o,
    items: itemsByOrder.get(o.id) ?? [],
  }));

  const unassignedOrders = await db
    .select({
      id: ordersTable.id,
      customerName: ordersTable.customerName,
      customerEmail: ordersTable.customerEmail,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      totalInCents: ordersTable.totalInCents,
      batchId: ordersTable.batchId,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(
      and(
        isNull(ordersTable.pickupEventId),
        not(inArray(ordersTable.status, ["cancelled", "no_show", "fulfilled"]))
      )
    );

  const unassignedIds = unassignedOrders.map((o) => o.id);
  const unassignedItems = unassignedIds.length > 0
    ? await db
        .select()
        .from(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, unassignedIds))
    : [];

  const unassignedItemsByOrder = new Map<number, typeof unassignedItems>();
  for (const item of unassignedItems) {
    const list = unassignedItemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    unassignedItemsByOrder.set(item.orderId, list);
  }

  const unassignedWithItems = unassignedOrders.map((o) => ({
    ...o,
    items: unassignedItemsByOrder.get(o.id) ?? [],
  }));

  res.json({ ...event, orders: ordersWithItems, unassignedOrders: unassignedWithItems });
});

router.post("/admin/pickup-events", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePickupEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [event] = await db
    .insert(pickupEventsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json({ ...event, assignedOrderCount: 0 });
});

router.patch("/admin/pickup-events/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePickupEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(pickupEventsTable)
    .set(parsed.data)
    .where(eq(pickupEventsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Pickup event not found" }); return; }

  const event = await getEventWithCount(id);
  res.json(event);
});

router.post("/admin/pickup-events/:id/assign-order", requireAdmin, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AssignOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { orderId } = parsed.data;

  const [event] = await db.select().from(pickupEventsTable).where(eq(pickupEventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Pickup event not found" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  await db
    .update(ordersTable)
    .set({ pickupEventId: eventId, status: "pickup_assigned" })
    .where(eq(ordersTable.id, orderId));

  await db
    .update(orderItemsTable)
    .set({ pickupEventId: eventId })
    .where(eq(orderItemsTable.orderId, orderId));

  await db.insert(orderEventsTable).values({
    orderId,
    eventType: "pickup_assigned",
    body: `All items assigned to pickup event: ${event.name} (${event.scheduledAt.toLocaleDateString()})`,
  });

  res.json({ message: "Order and all its items assigned to pickup event" });
});

router.post("/admin/pickup-events/:id/assign-item", requireAdmin, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AssignItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { orderItemId } = parsed.data;

  const [event] = await db.select().from(pickupEventsTable).where(eq(pickupEventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Pickup event not found" }); return; }

  const [item] = await db.select().from(orderItemsTable).where(eq(orderItemsTable.id, orderItemId)).limit(1);
  if (!item) { res.status(404).json({ error: "Order item not found" }); return; }

  await db
    .update(orderItemsTable)
    .set({ pickupEventId: eventId })
    .where(eq(orderItemsTable.id, orderItemId));

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, item.orderId)).limit(1);
  if (order && order.status !== "pickup_assigned" && order.status !== "weights_entered" && order.status !== "invoice_sent" && order.status !== "fulfilled") {
    await db
      .update(ordersTable)
      .set({ pickupEventId: eventId, status: "pickup_assigned" })
      .where(eq(ordersTable.id, item.orderId));
  }

  await db.insert(orderEventsTable).values({
    orderId: item.orderId,
    eventType: "pickup_assigned",
    body: `Item "${item.productName}" (×${item.quantity}) assigned to pickup event: ${event.name} (${event.scheduledAt.toLocaleDateString()})`,
  });

  res.json({ message: "Item assigned to pickup event", orderItemId, eventId });
});

router.post("/admin/pickup-events/:id/send-invoices", requireAdmin, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SendInvoicesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { weights } = parsed.data;

  const [event] = await db.select().from(pickupEventsTable).where(eq(pickupEventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Pickup event not found" }); return; }

  const results: Array<{ orderId: number; status: string; invoiceId?: string; remainingCents?: number }> = [];

  for (const { orderId, weightLbs, variant } of weights) {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) {
      results.push({ orderId, status: "order_not_found" });
      continue;
    }

    let pricePerLbCents = 0;
    let batchName = "unknown batch";

    if (order.batchId) {
      const [batch] = await db
        .select()
        .from(preorderBatchesTable)
        .where(eq(preorderBatchesTable.id, order.batchId))
        .limit(1);

      if (batch) {
        batchName = batch.name;
        if (variant === "whole") pricePerLbCents = batch.pricePerLbCentsWhole;
        else if (variant === "half") pricePerLbCents = batch.pricePerLbCentsHalf;
        else pricePerLbCents = batch.pricePerLbCentsQuarter;
      }
    }

    const finalTotalCents = pricePerLbCents > 0
      ? Math.round(weightLbs * pricePerLbCents)
      : 0;

    const depositPaidCents = order.totalInCents ?? 0;
    const remainingCents = Math.max(0, finalTotalCents - depositPaidCents);

    await db
      .update(ordersTable)
      .set({ finalWeightLbs: weightLbs, status: "weights_entered" })
      .where(eq(ordersTable.id, orderId));

    await db.insert(orderEventsTable).values({
      orderId,
      eventType: "weights_entered",
      body: `Final weight recorded: ${weightLbs} lbs (${variant} bird, batch: ${batchName})`,
    });

    if (remainingCents > 0 && pricePerLbCents > 0) {
      try {
        const invoiceId = await createStripeInvoice({
          orderId,
          email: order.customerEmail,
          customerName: order.customerName,
          remainingCents,
          weightLbs,
          pricePerLbCents,
          depositPaidCents,
          eventName: event.name,
        });

        if (invoiceId) {
          await db.update(ordersTable).set({ stripeInvoiceId: invoiceId, status: "invoice_sent" }).where(eq(ordersTable.id, orderId));
          await db.insert(orderEventsTable).values({
            orderId,
            eventType: "invoice_sent",
            body: `Stripe invoice ${invoiceId} sent to ${order.customerEmail}. Remaining balance: $${(remainingCents / 100).toFixed(2)} (${weightLbs} lbs × $${(pricePerLbCents / 100).toFixed(2)}/lb − $${(depositPaidCents / 100).toFixed(2)} deposit)`,
          });
          results.push({ orderId, status: "invoiced", invoiceId, remainingCents });
        } else {
          await db.update(ordersTable).set({ status: "invoice_sent" }).where(eq(ordersTable.id, orderId));
          await db.insert(orderEventsTable).values({
            orderId,
            eventType: "invoice_sent",
            body: `[STUB] Invoice queued for ${order.customerEmail}. Remaining: $${(remainingCents / 100).toFixed(2)} (${weightLbs} lbs × $${(pricePerLbCents / 100).toFixed(2)}/lb − $${(depositPaidCents / 100).toFixed(2)} deposit). Configure STRIPE_SECRET_KEY to send real invoices.`,
          });
          console.log(
            `[INVOICE STUB] Order ${orderId} — ${order.customerEmail}\n` +
            `  Weight: ${weightLbs} lbs (${variant}, ${batchName})\n` +
            `  Final: $${(finalTotalCents / 100).toFixed(2)} | Deposit paid: $${(depositPaidCents / 100).toFixed(2)} | Remaining: $${(remainingCents / 100).toFixed(2)}\n` +
            `  Pickup: ${event.name} on ${event.scheduledAt.toLocaleDateString()}`
          );
          results.push({ orderId, status: "stub", remainingCents });
        }
      } catch (err: any) {
        await db.insert(orderEventsTable).values({
          orderId,
          eventType: "invoice_sent",
          body: `Stripe invoice failed for ${order.customerEmail}: ${err.message}. Remaining: $${(remainingCents / 100).toFixed(2)}`,
        });
        results.push({ orderId, status: "error", remainingCents });
        console.error(`[INVOICE ERROR] Order ${orderId}:`, err.message);
      }
    } else {
      await db.update(ordersTable).set({ status: "invoice_sent" }).where(eq(ordersTable.id, orderId));
      await db.insert(orderEventsTable).values({
        orderId,
        eventType: "invoice_sent",
        body: `No additional charge: deposit covers full amount. Weight: ${weightLbs} lbs.${pricePerLbCents === 0 ? " (No batch price configured — assign order to a batch first)" : ""}`,
      });
      results.push({ orderId, status: "deposit_covers_balance", remainingCents: 0 });
    }
  }

  res.json({
    message: `Processed ${weights.length} order(s)`,
    results,
  });
});

export default router;
