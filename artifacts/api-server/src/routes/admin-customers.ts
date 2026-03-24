import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, desc, count, inArray } from "drizzle-orm";
import { db, customersTable, ordersTable, orderEventsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";
import * as z from "zod";

const router: IRouter = Router();

const ListCustomersQuery = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/admin/customers", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListCustomersQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, offset } = parsed.data;

  const customers = await db
    .select({
      id: customersTable.id,
      email: customersTable.email,
      name: customersTable.name,
      phone: customersTable.phone,
      createdAt: customersTable.createdAt,
    })
    .from(customersTable)
    .orderBy(desc(customersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const customerIds = customers.map((c) => c.id);
  let countMap = new Map<number, number>();

  if (customerIds.length > 0) {
    const counts = await db
      .select({ customerId: ordersTable.customerId, value: count() })
      .from(ordersTable)
      .where(inArray(ordersTable.customerId, customerIds))
      .groupBy(ordersTable.customerId);
    countMap = new Map(counts.map((r) => [r.customerId!, Number(r.value)]));
  }

  res.json(customers.map((c) => ({
    ...c,
    orderCount: countMap.get(c.id) ?? 0,
  })));
});

router.get("/admin/customers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, id))
    .limit(1);

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const orders = await db
    .select({
      id: ordersTable.id,
      customerName: ordersTable.customerName,
      customerEmail: ordersTable.customerEmail,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      totalInCents: ordersTable.totalInCents,
      finalWeightLbs: ordersTable.finalWeightLbs,
      refundedGiblets: ordersTable.refundedGiblets,
      stripeInvoiceId: ordersTable.stripeInvoiceId,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.customerId, id))
    .orderBy(desc(ordersTable.createdAt));

  const orderIds = orders.map((o) => o.id);

  let eventTimeline: Array<{
    id: number;
    orderId: number;
    eventType: string;
    body: string;
    createdAt: Date;
  }> = [];

  if (orderIds.length > 0) {
    eventTimeline = await db
      .select()
      .from(orderEventsTable)
      .where(inArray(orderEventsTable.orderId, orderIds))
      .orderBy(desc(orderEventsTable.createdAt));
  }

  res.json({
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    emailVerified: customer.emailVerified,
    orderCount: orders.length,
    orders,
    eventTimeline,
    createdAt: customer.createdAt,
  });
});

export default router;
