import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, customersTable, customerCartsTable } from "@workspace/db";
import { persistCartForCustomer } from "./cart.js";
import {
  AuthRegisterBody,
  AuthLoginBody,
  AuthUpdateProfileBody,
} from "@workspace/api-zod";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { sendEmail } from "../lib/email.js";

const router: IRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many password reset requests. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

function toCustomerSession(customer: typeof customersTable.$inferSelect) {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone ?? null,
  };
}

router.post("/auth/register", authLimiter, async (req, res): Promise<void> => {
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

  const verificationToken = crypto.randomBytes(32).toString("hex");

  const [customer] = await db
    .insert(customersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      phone: phone ?? null,
      verificationToken,
    })
    .returning();

  req.session.customerId = customer.id;
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );

  const verifyLink = `${process.env.STORE_BASE_URL}/auth/verify-email?token=${verificationToken}`;
  await sendEmail({
    to: customer.email,
    subject: "Verify your email — Jack Pine Farm",
    text: `Hi ${customer.name},\n\nPlease verify your email address by clicking the link below:\n\n${verifyLink}\n\nThanks,\nJack Pine Farm`,
    html: `<p>Hi ${customer.name},</p><p>Please <a href="${verifyLink}">click here to verify your email</a>.</p><p>Thanks,<br>Jack Pine Farm</p>`,
  });

  res.status(201).json(toCustomerSession(customer));
});

router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
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

  if (!customer || !customer.passwordHash || !(await bcrypt.compare(password, customer.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Email verification is sent but not enforced on login intentionally —
  // a real email provider is required before gating access by emailVerified.
  // To enforce: add `if (!customer.emailVerified) { res.status(403)... }`

  req.session.customerId = customer.id;

  const [dbCart] = await db
    .select()
    .from(customerCartsTable)
    .where(eq(customerCartsTable.customerId, customer.id))
    .limit(1);

  if (dbCart && dbCart.items.length > 0) {
    const sessionCart: Array<{ productId: number; quantity: number; addGiblets: boolean }> =
      req.session.cart ?? [];
    const merged = [...dbCart.items];
    for (const si of sessionCart) {
      const existing = merged.find((m) => m.productId === si.productId);
      if (existing) {
        existing.quantity = Math.max(existing.quantity, si.quantity);
        if (si.addGiblets) existing.addGiblets = true;
      } else {
        merged.push(si);
      }
    }
    req.session.cart = merged;
  }

  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );

  await persistCartForCustomer(customer.id, req.session.cart ?? []);

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

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Verification token is required" });
    return;
  }

  const [customer] = await db
    .select({ id: customersTable.id, emailVerified: customersTable.emailVerified })
    .from(customersTable)
    .where(eq(customersTable.verificationToken, token))
    .limit(1);

  if (!customer) {
    res.status(400).json({ error: "Invalid verification token" });
    return;
  }

  if (!customer.emailVerified) {
    await db
      .update(customersTable)
      .set({ emailVerified: true, verificationToken: null })
      .where(eq(customersTable.id, customer.id));
  }

  res.json({ message: "Email verified successfully." });
});

router.post("/auth/forgot-password", resetLimiter, async (req, res): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [customer] = await db
    .select({ id: customersTable.id, email: customersTable.email, name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (customer) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db
      .update(customersTable)
      .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
      .where(eq(customersTable.id, customer.id));

    req.log.info({ customerId: customer.id }, "[EMAIL STUB] Password reset email would be sent");
  }

  res.json({ message: "If an account with that email exists, a reset link has been sent." });
});

router.post("/auth/reset-password", resetLimiter, async (req, res): Promise<void> => {
  const { token, password } = req.body;

  if (!token || typeof token !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Token and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.resetToken, token))
    .limit(1);

  if (
    !customer ||
    !customer.resetTokenExpiresAt ||
    customer.resetTokenExpiresAt < new Date()
  ) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(customersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
    .where(eq(customersTable.id, customer.id));

  res.json({ message: "Password updated successfully. You can now log in." });
});

export default router;
