import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, count, inArray } from "drizzle-orm";
import { db, pickupEventsTable, ordersTable, orderEventsTable } from "@workspace/db";
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

const WeightEntry = z.object({
  orderId: z.number().int().positive(),
  weightLbs: z.number().positive(),
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
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.pickupEventId, id));

  res.json({ ...event, orders: assignedOrders });
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

  await db.insert(orderEventsTable).values({
    orderId,
    eventType: "pickup_assigned",
    body: `Assigned to pickup event: ${event.name} (${event.scheduledAt.toLocaleDateString()})`,
  });

  res.json({ message: "Order assigned to pickup event" });
});

router.post("/admin/pickup-events/:id/send-invoices", requireAdmin, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SendInvoicesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { weights } = parsed.data;

  const [event] = await db.select().from(pickupEventsTable).where(eq(pickupEventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Pickup event not found" }); return; }

  for (const { orderId, weightLbs } of weights) {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) continue;

    await db
      .update(ordersTable)
      .set({ finalWeightLbs: weightLbs, status: "invoice_sent" })
      .where(eq(ordersTable.id, orderId));

    await db.insert(orderEventsTable).values({
      orderId,
      eventType: "weights_entered",
      body: `Final weight recorded: ${weightLbs} lbs`,
    });

    await db.insert(orderEventsTable).values({
      orderId,
      eventType: "invoice_sent",
      body: `[EMAIL STUB] Final balance invoice sent to ${order.customerEmail} for ${weightLbs} lbs. Configure Stripe billing + email provider to send real invoices.`,
    });

    console.log(
      `[INVOICE STUB] Order ${orderId} — ${order.customerEmail}\n` +
      `  Weight: ${weightLbs} lbs\n` +
      `  Pickup: ${event.name} on ${event.scheduledAt.toLocaleDateString()}\n` +
      `  (Configure STRIPE_SECRET_KEY + email provider to send real invoices)`
    );
  }

  res.json({ message: `Weights recorded and invoice stubs sent for ${weights.length} orders` });
});

export default router;
