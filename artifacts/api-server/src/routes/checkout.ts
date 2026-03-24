import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { inArray, eq } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  productsTable,
  ordersTable,
  orderItemsTable,
  stripePendingCheckoutsTable,
  customerCartsTable,
  type CartLineItem,
} from "@workspace/db";
import { CreateStripeCheckoutBody, CreateCashOrderBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

async function buildOrderItems(
  sessionCart: Array<{ productId: number; quantity: number; addGiblets: boolean }>
) {
  if (sessionCart.length === 0) return null;

  const productIds = sessionCart.map((i) => i.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const productMap = new Map(products.map((p) => [p.id, p]));
  const lineItems: CartLineItem[] = [];

  for (const item of sessionCart) {
    const product = productMap.get(item.productId);
    if (!product) continue;

    const isMeat = product.pricingType === "deposit";

    lineItems.push({
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      pricingType: product.pricingType,
      unitPriceInCents: product.priceInCents,
      unitLabel: product.unitLabel ?? null,
      isGiblets: false,
      lineTotalInCents: product.priceInCents * item.quantity,
    });

    if (isMeat && item.addGiblets) {
      lineItems.push({
        productId: item.productId,
        productName: `${product.name} – Giblets Add-on`,
        quantity: item.quantity,
        pricingType: "unit",
        unitPriceInCents: 200,
        unitLabel: "bird",
        isGiblets: true,
        lineTotalInCents: 200 * item.quantity,
      });
    }
  }

  const totalInCents = lineItems.reduce((s, i) => s + i.lineTotalInCents, 0);
  return { lineItems, totalInCents };
}

export function generateClaimToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createOrderFromData(data: {
  customerId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string | null;
  paymentMethod: "stripe" | "cash";
  status: "pending_payment" | "deposit_paid" | "cash_pending" | "cancelled";
  totalInCents: number;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  lineItems: CartLineItem[];
  claimToken?: string | null;
  claimTokenExpiresAt?: Date | null;
}) {
  const [order] = await db
    .insert(ordersTable)
    .values({
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      notes: data.notes,
      paymentMethod: data.paymentMethod,
      status: data.status,
      totalInCents: data.totalInCents,
      stripeCheckoutSessionId: data.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: data.stripePaymentIntentId ?? null,
      claimToken: data.claimToken ?? null,
      claimTokenExpiresAt: data.claimTokenExpiresAt ?? null,
    })
    .returning();

  await db.insert(orderItemsTable).values(
    data.lineItems.map((li) => ({
      orderId: order.id,
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

  return order;
}

router.post("/checkout/stripe", async (req, res): Promise<void> => {
  const parsed = CreateStripeCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const session = (req as any).session;
  const cart: Array<{ productId: number; quantity: number; addGiblets: boolean }> = session.cart ?? [];

  if (cart.length === 0) {
    res.status(400).json({ error: "Your cart is empty" });
    return;
  }

  const orderData = await buildOrderItems(cart);
  if (!orderData) {
    res.status(400).json({ error: "Could not build order" });
    return;
  }

  const { name: customerName, email: customerEmail, phone: customerPhone, notes } = parsed.data;

  const stripe = getStripe();

  if (!stripe) {
    res.status(503).json({ error: "Online payments are not configured yet. Please choose Cash at Pickup." });
    return;
  }

  const baseUrl = process.env.STORE_BASE_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}/store`;

  const stripeLineItems = orderData.lineItems.map((li) => ({
    price_data: {
      currency: "usd",
      product_data: { name: li.productName },
      unit_amount: li.unitPriceInCents,
    },
    quantity: li.quantity,
  }));

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: stripeLineItems,
    mode: "payment",
    customer_email: customerEmail,
    success_url: `${baseUrl}/order-confirmation?stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout`,
  });

  await db.insert(stripePendingCheckoutsTable).values({
    stripeSessionId: checkoutSession.id,
    customerId: session.customerId ?? null,
    customerName,
    customerEmail,
    customerPhone,
    notes: notes ?? null,
    cartSnapshot: orderData.lineItems,
    totalInCents: orderData.totalInCents,
  });

  res.json({ checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id });
});

router.post("/checkout/cash", async (req, res): Promise<void> => {
  const parsed = CreateCashOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const session = (req as any).session;
  const cart: Array<{ productId: number; quantity: number; addGiblets: boolean }> = session.cart ?? [];

  if (cart.length === 0) {
    res.status(400).json({ error: "Your cart is empty" });
    return;
  }

  const orderData = await buildOrderItems(cart);
  if (!orderData) {
    res.status(400).json({ error: "Could not build order" });
    return;
  }

  const { name: customerName, email: customerEmail, phone: customerPhone, notes } = parsed.data;

  const isGuest = !session.customerId;
  const claimToken = isGuest ? generateClaimToken() : null;
  const claimTokenExpiresAt = claimToken ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null; // 30 days

  const order = await createOrderFromData({
    customerId: session.customerId ?? null,
    customerName,
    customerEmail,
    customerPhone,
    notes: notes ?? null,
    paymentMethod: "cash",
    status: "cash_pending",
    totalInCents: orderData.totalInCents,
    lineItems: orderData.lineItems,
    claimToken,
    claimTokenExpiresAt,
  });

  session.cart = [];
  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  if (session.customerId) {
    await db
      .delete(customerCartsTable)
      .where(eq(customerCartsTable.customerId, session.customerId));
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  const baseUrl = process.env.STORE_BASE_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}/store`;
  const emailParams = encodeURIComponent(customerEmail);
  const accountClaimLine = claimToken
    ? `\n  Claim this order into your account: ${baseUrl}/auth/claim-order?token=${claimToken}`
    : `\n  Order detail: ${baseUrl}/account/orders/${order.id}`;
  const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${emailParams}`;
  console.log(
    `[EMAIL STUB] Order confirmation for ${customerEmail}:\n  Order #${String(order.id).padStart(6, "0")}\n  Total: $${(orderData.totalInCents / 100).toFixed(2)}\n  Payment: Cash at Pickup${accountClaimLine}\n  Unsubscribe: ${unsubscribeUrl}`
  );

  res.status(201).json({ ...order, items });
});

router.post("/orders/claim", async (req, res): Promise<void> => {
  const session = (req as any).session;
  if (!session.customerId) {
    res.status(401).json({ error: "You must be logged in to claim an order" });
    return;
  }

  const { token } = req.body;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Claim token is required" });
    return;
  }

  const now = new Date();
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.claimToken, token))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Invalid or expired claim token" });
    return;
  }

  if (order.claimTokenExpiresAt && order.claimTokenExpiresAt < now) {
    res.status(410).json({ error: "This claim link has expired" });
    return;
  }

  if (order.customerId) {
    // Already claimed — idempotent response
    res.json({ orderId: order.id, message: "Order already linked to an account" });
    return;
  }

  await db
    .update(ordersTable)
    .set({ customerId: session.customerId, claimToken: null, claimTokenExpiresAt: null })
    .where(eq(ordersTable.id, order.id));

  res.json({ orderId: order.id, message: "Order successfully linked to your account" });
});

export default router;
