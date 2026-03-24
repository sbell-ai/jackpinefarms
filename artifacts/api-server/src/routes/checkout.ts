import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { inArray, eq } from "drizzle-orm";
import { db, productsTable, ordersTable, orderItemsTable } from "@workspace/db";
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
  const lineItems: Array<{
    productId: number;
    productName: string;
    quantity: number;
    pricingType: string;
    unitPriceInCents: number;
    unitLabel: string | null;
    isGiblets: boolean;
    lineTotalInCents: number;
  }> = [];

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

  const [order] = await db
    .insert(ordersTable)
    .values({
      customerId: session.customerId ?? null,
      customerName,
      customerEmail,
      customerPhone,
      notes: notes ?? null,
      paymentMethod: "stripe",
      status: "pending_payment",
      totalInCents: orderData.totalInCents,
    })
    .returning();

  await db.insert(orderItemsTable).values(
    orderData.lineItems.map((li) => ({
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
    metadata: { orderId: String(order.id) },
    success_url: `${baseUrl}/order-confirmation?orderId=${order.id}&stripe=1`,
    cancel_url: `${baseUrl}/checkout`,
  });

  await db
    .update(ordersTable)
    .set({ stripeCheckoutSessionId: checkoutSession.id })
    .where(eq(ordersTable.id, order.id));

  res.json({ checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id, orderId: order.id });
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

  const [order] = await db
    .insert(ordersTable)
    .values({
      customerId: session.customerId ?? null,
      customerName,
      customerEmail,
      customerPhone,
      notes: notes ?? null,
      paymentMethod: "cash",
      status: "cash_pending",
      totalInCents: orderData.totalInCents,
    })
    .returning();

  await db.insert(orderItemsTable).values(
    orderData.lineItems.map((li) => ({
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

  session.cart = [];
  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.status(201).json({ ...order, items });
});

export default router;
