import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, pickupEventsTable } from "@workspace/db";

const router: IRouter = Router();

function requireCustomer(req: any, res: any): boolean {
  if (!req.session.customerId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

export async function getOrderWithItems(orderId: number) {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select({
      id: orderItemsTable.id,
      productId: orderItemsTable.productId,
      productName: orderItemsTable.productName,
      quantity: orderItemsTable.quantity,
      pricingType: orderItemsTable.pricingType,
      unitPriceInCents: orderItemsTable.unitPriceInCents,
      unitLabel: orderItemsTable.unitLabel,
      variantLabel: orderItemsTable.variantLabel,
      isGiblets: orderItemsTable.isGiblets,
      lineTotalInCents: orderItemsTable.lineTotalInCents,
    })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId));

  let pickupEventName: string | null = null;
  let pickupEventScheduledAt: string | null = null;
  if (order.pickupEventId != null) {
    const [event] = await db
      .select({ name: pickupEventsTable.name, scheduledAt: pickupEventsTable.scheduledAt })
      .from(pickupEventsTable)
      .where(eq(pickupEventsTable.id, order.pickupEventId))
      .limit(1);
    if (event) {
      pickupEventName = event.name;
      pickupEventScheduledAt = event.scheduledAt.toISOString();
    }
  }

  return { ...order, items, pickupEventName, pickupEventScheduledAt };
}

router.get("/orders/by-stripe-session/:sessionId", async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const [order] = await db
    .select({ id: ordersTable.id, status: ordersTable.status, pickupEventId: ordersTable.pickupEventId })
    .from(ordersTable)
    .where(eq(ordersTable.stripeCheckoutSessionId, sessionId))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found yet" });
    return;
  }

  let pickupEventName: string | null = null;
  let pickupEventScheduledAt: string | null = null;
  if (order.pickupEventId != null) {
    const [event] = await db
      .select({ name: pickupEventsTable.name, scheduledAt: pickupEventsTable.scheduledAt })
      .from(pickupEventsTable)
      .where(eq(pickupEventsTable.id, order.pickupEventId))
      .limit(1);
    if (event) {
      pickupEventName = event.name;
      pickupEventScheduledAt = event.scheduledAt.toISOString();
    }
  }

  res.json({ id: order.id, status: order.status, pickupEventName, pickupEventScheduledAt });
});

router.get("/orders", async (req, res): Promise<void> => {
  if (!requireCustomer(req, res)) return;

  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.customerId, req.session.customerId!))
    .orderBy(desc(ordersTable.createdAt));

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

router.get("/orders/:id", async (req, res): Promise<void> => {
  if (!requireCustomer(req, res)) return;

  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }

  const order = await getOrderWithItems(id);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.customerId !== req.session.customerId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(order);
});

export default router;
