import { Router, type IRouter } from "express";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  pickupEventsTable,
  ordersTable,
  orderItemsTable,
  orderEventsTable,
  preorderBatchesTable,
} from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";
import { createStripeInvoice } from "../lib/stripe-invoice.js";

const router: IRouter = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const CreateEventBody = z.object({
  name: z.string().min(1).max(200),
  scheduledAt: z.string().datetime(),
  locationNotes: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
});

const UpdateEventBody = z.object({
  name: z.string().min(1).max(200).optional(),
  scheduledAt: z.string().datetime().optional(),
  locationNotes: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
});

const AssignOrderBody = z.object({
  orderId: z.number().int().positive(),
});

const SendInvoicesBody = z.array(z.object({
  orderId: z.number().int().positive(),
  weightLbs: z.number().positive(),
  variant: z.enum(["whole", "half", "quarter"]).default("whole"),
}));

// ─── GET /farmops/pickup-events ───────────────────────────────────────────────

router.get("/farmops/pickup-events", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;

  const events = await db
    .select({
      id: pickupEventsTable.id,
      name: pickupEventsTable.name,
      scheduledAt: pickupEventsTable.scheduledAt,
      status: pickupEventsTable.status,
      isPublic: pickupEventsTable.isPublic,
      capacity: pickupEventsTable.capacity,
      locationNotes: pickupEventsTable.locationNotes,
      createdAt: pickupEventsTable.createdAt,
    })
    .from(pickupEventsTable)
    .where(eq(pickupEventsTable.tenantId, tenantId))
    .orderBy(desc(pickupEventsTable.scheduledAt));

  // Attach order count per event
  const orderCounts = await db
    .select({ pickupEventId: ordersTable.pickupEventId, cnt: count() })
    .from(ordersTable)
    .where(eq(ordersTable.tenantId, tenantId))
    .groupBy(ordersTable.pickupEventId);

  const countMap = new Map(orderCounts.map((r) => [r.pickupEventId, r.cnt]));

  res.json(events.map((e) => ({
    ...e,
    orderCount: countMap.get(e.id) ?? 0,
    spotsRemaining: e.capacity != null ? Math.max(0, e.capacity - (countMap.get(e.id) ?? 0)) : null,
  })));
});

// ─── POST /farmops/pickup-events ──────────────────────────────────────────────

router.post(
  "/farmops/pickup-events",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = CreateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { name, scheduledAt, locationNotes, capacity, isPublic } = parsed.data;

    const [event] = await db
      .insert(pickupEventsTable)
      .values({
        tenantId,
        name,
        scheduledAt: new Date(scheduledAt),
        locationNotes: locationNotes ?? null,
        capacity: capacity ?? null,
        isPublic: isPublic ?? false,
      })
      .returning();

    res.status(201).json(event);
  }
);

// ─── PATCH /farmops/pickup-events/:id ─────────────────────────────────────────

router.patch(
  "/farmops/pickup-events/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid event ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = UpdateEventBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const [existing] = await db
      .select({ id: pickupEventsTable.id })
      .from(pickupEventsTable)
      .where(and(eq(pickupEventsTable.id, id), eq(pickupEventsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Pickup event not found" }); return; }

    const { scheduledAt, ...rest } = bodyParsed.data;
    const updates: Record<string, unknown> = { ...rest };
    if (scheduledAt) updates.scheduledAt = new Date(scheduledAt);

    const [updated] = await db
      .update(pickupEventsTable)
      .set(updates)
      .where(eq(pickupEventsTable.id, id))
      .returning();

    res.json(updated);
  }
);

// ─── PATCH /farmops/pickup-events/:id/toggle-publish ─────────────────────────

router.patch(
  "/farmops/pickup-events/:id/toggle-publish",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid event ID" }); return; }
    const { id } = parsed.data;

    const [existing] = await db
      .select()
      .from(pickupEventsTable)
      .where(and(eq(pickupEventsTable.id, id), eq(pickupEventsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Pickup event not found" }); return; }

    const [updated] = await db
      .update(pickupEventsTable)
      .set({ isPublic: !existing.isPublic })
      .where(eq(pickupEventsTable.id, id))
      .returning();

    res.json(updated);
  }
);

// ─── GET /farmops/pickup-events/:id ───────────────────────────────────────────

router.get("/farmops/pickup-events/:id", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid event ID" }); return; }
  const { id } = parsed.data;

  const [event] = await db
    .select()
    .from(pickupEventsTable)
    .where(and(eq(pickupEventsTable.id, id), eq(pickupEventsTable.tenantId, tenantId)))
    .limit(1);
  if (!event) { res.status(404).json({ error: "Pickup event not found" }); return; }

  // Get all orders assigned to this event for this tenant
  const orders = await db
    .select({
      id: ordersTable.id,
      customerName: ordersTable.customerName,
      customerEmail: ordersTable.customerEmail,
      customerPhone: ordersTable.customerPhone,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      totalInCents: ordersTable.totalInCents,
      finalWeightLbs: ordersTable.finalWeightLbs,
      batchId: ordersTable.batchId,
      stripeInvoiceId: ordersTable.stripeInvoiceId,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.pickupEventId, id), eq(ordersTable.tenantId, tenantId)));

  // Attach items to each order
  const orderIds = orders.map((o) => o.id);
  let items: { orderId: number; productName: string; quantity: number; pricingType: string; lineTotalInCents: number; isGiblets: boolean }[] = [];
  if (orderIds.length > 0) {
    const rows = await db
      .select({
        orderId: orderItemsTable.orderId,
        productName: orderItemsTable.productName,
        quantity: orderItemsTable.quantity,
        pricingType: orderItemsTable.pricingType,
        lineTotalInCents: orderItemsTable.lineTotalInCents,
        isGiblets: orderItemsTable.isGiblets,
      })
      .from(orderItemsTable)
      .where(sql`${orderItemsTable.orderId} = ANY(ARRAY[${sql.join(orderIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
    items = rows;
  }

  const itemsByOrder = new Map<number, typeof items>();
  for (const item of items) {
    if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
    itemsByOrder.get(item.orderId)!.push(item);
  }

  const ordersWithItems = orders.map((o) => ({
    ...o,
    items: itemsByOrder.get(o.id) ?? [],
  }));

  res.json({ ...event, orders: ordersWithItems });
});

// ─── POST /farmops/pickup-events/:id/assign-order ─────────────────────────────

router.post(
  "/farmops/pickup-events/:id/assign-order",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid event ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = AssignOrderBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }
    const { orderId } = bodyParsed.data;

    const [event] = await db
      .select({ id: pickupEventsTable.id })
      .from(pickupEventsTable)
      .where(and(eq(pickupEventsTable.id, id), eq(pickupEventsTable.tenantId, tenantId)))
      .limit(1);
    if (!event) { res.status(404).json({ error: "Pickup event not found" }); return; }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.tenantId, tenantId)))
      .limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const advanceStatus =
      order.status === "deposit_paid" || order.status === "cash_pending"
        ? "pickup_assigned"
        : order.status;

    const [updated] = await db
      .update(ordersTable)
      .set({ pickupEventId: id, status: advanceStatus })
      .where(eq(ordersTable.id, orderId))
      .returning();

    if (advanceStatus !== order.status) {
      await db.insert(orderEventsTable).values({
        orderId,
        eventType: "status_change",
        body: `Status changed from ${order.status} to ${advanceStatus} (assigned to pickup event).`,
      });
    }

    res.json(updated);
  }
);

// ─── POST /farmops/pickup-events/:id/send-invoices ────────────────────────────

router.post(
  "/farmops/pickup-events/:id/send-invoices",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid event ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = SendInvoicesBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const [event] = await db
      .select({ id: pickupEventsTable.id, name: pickupEventsTable.name })
      .from(pickupEventsTable)
      .where(and(eq(pickupEventsTable.id, id), eq(pickupEventsTable.tenantId, tenantId)))
      .limit(1);
    if (!event) { res.status(404).json({ error: "Pickup event not found" }); return; }

    let sent = 0;
    const errors: string[] = [];

    for (const entry of bodyParsed.data) {
      const { orderId, weightLbs, variant } = entry;

      const [order] = await db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.tenantId, tenantId)))
        .limit(1);
      if (!order) { errors.push(`Order #${orderId}: not found`); continue; }
      if (!order.batchId) { errors.push(`Order #${orderId}: not assigned to a preorder batch`); continue; }

      const items = await db
        .select({ pricingType: orderItemsTable.pricingType, lineTotalInCents: orderItemsTable.lineTotalInCents })
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, orderId));
      const depositPaidCents = items
        .filter((i) => i.pricingType === "deposit")
        .reduce((s, i) => s + i.lineTotalInCents, 0);

      const [batch] = await db
        .select()
        .from(preorderBatchesTable)
        .where(eq(preorderBatchesTable.id, order.batchId))
        .limit(1);
      if (!batch) { errors.push(`Order #${orderId}: preorder batch not found`); continue; }

      const pricePerLbCents =
        variant === "half" ? batch.pricePerLbCentsHalf :
        variant === "quarter" ? batch.pricePerLbCentsQuarter :
        batch.pricePerLbCentsWhole;

      const finalTotalCents = Math.round(weightLbs * pricePerLbCents);
      const remainingCents = Math.max(0, finalTotalCents - depositPaidCents);

      await db.update(ordersTable).set({ finalWeightLbs: weightLbs }).where(eq(ordersTable.id, orderId));

      if (remainingCents === 0) {
        await db.update(ordersTable).set({ status: "invoice_sent" }).where(eq(ordersTable.id, orderId));
        await db.insert(orderEventsTable).values({
          orderId,
          eventType: "invoice_sent",
          body: `No additional charge: deposit covers full balance. Weight: ${weightLbs} lbs.`,
        });
        sent++;
        continue;
      }

      try {
        const invoiceId = await createStripeInvoice({
          orderId,
          email: order.customerEmail,
          customerName: order.customerName,
          remainingCents,
          weightLbs,
          pricePerLbCents,
          depositPaidCents,
          eventName: batch.name,
        });

        await db.update(ordersTable)
          .set({ stripeInvoiceId: invoiceId ?? null, status: "invoice_sent" })
          .where(eq(ordersTable.id, orderId));
        await db.insert(orderEventsTable).values({
          orderId,
          eventType: "invoice_sent",
          body: invoiceId
            ? `Stripe invoice ${invoiceId} sent to ${order.customerEmail}. Remaining: $${(remainingCents / 100).toFixed(2)}.`
            : `[STUB] Invoice queued for ${order.customerEmail}. Remaining: $${(remainingCents / 100).toFixed(2)}.`,
        });
        sent++;
      } catch (err: unknown) {
        errors.push(`Order #${orderId}: ${(err as Error).message}`);
      }
    }

    res.json({ sent, errors });
  }
);

export default router;
