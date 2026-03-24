import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  AuthRegisterBody,
  AuthLoginBody,
  AuthUpdateProfileBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toCustomerSession(customer: typeof customersTable.$inferSelect) {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone ?? null,
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = AuthRegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, name, phone } = parsed.data;

  const existing = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [customer] = await db
    .insert(customersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      phone: phone ?? null,
    })
    .returning();

  req.session.customerId = customer.id;
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );

  res.status(201).json(toCustomerSession(customer));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = AuthLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.email, email.toLowerCase()))
    .limit(1);

  if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.customerId = customer.id;
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );

  res.json(toCustomerSession(customer));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  delete req.session.customerId;
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.customerId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, req.session.customerId))
    .limit(1);

  if (!customer) {
    delete req.session.customerId;
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(toCustomerSession(customer));
});

router.patch("/auth/profile", async (req, res): Promise<void> => {
  if (!req.session.customerId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = AuthUpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof customersTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone ?? null;

  const [updated] = await db
    .update(customersTable)
    .set(updates)
    .where(eq(customersTable.id, req.session.customerId))
    .returning();

  res.json(toCustomerSession(updated));
});

export default router;
