import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, desc, count, inArray, ilike, or } from "drizzle-orm";
import { db, customersTable, ordersTable, orderEventsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/require-platform-admin.js";
import * as z from "zod";

const router: IRouter = Router();

const ListCustomersQuery = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
});

const CreateAdminCustomerBody = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/admin/customers", requirePlatformAdmin, async (req, res): Promise<void> => {
  const parsed = ListCustomersQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { limit, offset, search } = parsed.data;

  const baseQuery = db
    .select({
      id: customersTable.id,
      email: customersTable.email,
      name: customersTable.name,
      phone: customersTable.phone,
      notes: customersTable.notes,
      createdAt: customersTable.createdAt,
    })
    .from(customersTable);

  const customers = await (search
    ? baseQuery
        .where(
          or(
            ilike(customersTable.name, `%${search}%`),
            ilike(customersTable.email, `%${search}%`),
            ilike(customersTable.phone, `%${search}%`),
          ),
        )
        .orderBy(desc(customersTable.createdAt))
        .limit(limit)
        .offset(offset)
    : baseQuery
        .orderBy(desc(customersTable.createdAt))
        .limit(limit)
        .offset(offset));

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

router.post("/admin/customers", requirePlatformAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, email, phone, notes } = parsed.data;

  if (email) {
    const [existing] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.email, email))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "A customer with this email already exists." });
      return;
    }
  }

  const [customer] = await db
    .insert(customersTable)
    .values({
      name,
      email: email ?? null,
      phone: phone ?? null,
      notes: notes ?? null,
      emailVerified: false,
    })
    .returning({
      id: customersTable.id,
      name: customersTable.name,
      email: customersTable.email,
      phone: customersTable.phone,
      notes: customersTable.notes,
      createdAt: customersTable.createdAt,
    });

  res.status(201).json({ ...customer, orderCount: 0 });
});

router.get("/admin/customers/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
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
    notes: customer.notes,
    emailVerified: customer.emailVerified,
    orderCount: orders.length,
    orders,
    eventTimeline,
    createdAt: customer.createdAt,
  });
});

const UpdateCustomerBody = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.patch("/admin/customers/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.id, id))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Customer not found" }); return; }

  if (parsed.data.email !== undefined && parsed.data.email !== null) {
    const [dupe] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.email, parsed.data.email))
      .limit(1);
    if (dupe && dupe.id !== id) {
      res.status(409).json({ error: "A customer with this email already exists." });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  if (Object.keys(updates).length > 0) {
    await db.update(customersTable).set(updates).where(eq(customersTable.id, id));
  }

  const [updated] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      email: customersTable.email,
      phone: customersTable.phone,
      notes: customersTable.notes,
      emailVerified: customersTable.emailVerified,
      createdAt: customersTable.createdAt,
    })
    .from(customersTable)
    .where(eq(customersTable.id, id))
    .limit(1);

  const [orderCount] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(eq(ordersTable.customerId, id));

  res.json({ ...updated, orderCount: Number(orderCount?.value ?? 0) });
});

router.delete("/admin/customers/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.id, id))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Customer not found" }); return; }

  const [orderCountRow] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(eq(ordersTable.customerId, id));
  const orderCount = Number(orderCountRow?.value ?? 0);
  if (orderCount > 0) {
    res.status(409).json({ error: `Cannot delete — this customer has ${orderCount} order${orderCount !== 1 ? "s" : ""}. Remove their orders first.` });
    return;
  }

  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.json({ message: "Customer deleted" });
});

export default router;
