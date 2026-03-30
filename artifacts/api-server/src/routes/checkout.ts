import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { inArray, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  productsTable,
  ordersTable,
  orderItemsTable,
  stripePendingCheckoutsTable,
  customerCartsTable,
  couponsTable,
  type CartLineItem,
} from "@workspace/db";
import { CreateStripeCheckoutBody, CreateCashOrderBody } from "@workspace/api-zod";
import type Stripe from "stripe";

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
      unitPriceInCents:
        product.isOnSale && product.salePriceCents != null
          ? product.salePriceCents
          : product.priceInCents,
      unitLabel: product.unitLabel ?? null,
      isGiblets: false,
      lineTotalInCents:
        (product.isOnSale && product.salePriceCents != null
          ? product.salePriceCents
          : product.priceInCents) * item.quantity,
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

async function validateCoupon(code: string, subtotalInCents: number) {
  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.code, code.trim().toUpperCase()))
    .limit(1);

  if (!coupon || !coupon.isActive) return null;
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return null;
  if (coupon.endsAt && coupon.endsAt < now) return null;
  if (coupon.maxRedemptions != null && coupon.redemptionsCount >= coupon.maxRedemptions) return null;

  const discountAmountCents =
    coupon.discountType === "percent"
      ? Math.round(subtotalInCents * coupon.discountValue / 100)
      : Math.min(coupon.discountValue, subtotalInCents);

  return { coupon, discountAmountCents };
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
  appliedCouponCode?: string | null;
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
      appliedCouponCode: data.appliedCouponCode ?? null,
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

  let discountAmountCents = 0;
  let appliedCouponCode: string | null = null;
  let stripePromotionCodeId: string | null = null;

  const sessionCouponCode: string | undefined = session.appliedCouponCode;
  if (sessionCouponCode) {
    const couponResult = await validateCoupon(sessionCouponCode, orderData.totalInCents);
    if (couponResult) {
      discountAmountCents = couponResult.discountAmountCents;
      appliedCouponCode = couponResult.coupon.code;
      stripePromotionCodeId = couponResult.coupon.stripePromotionCodeId ?? null;
    }
  }

  const totalAfterDiscount = Math.max(0, orderData.totalInCents - discountAmountCents);

  if (totalAfterDiscount < 50) {
    res.status(400).json({ error: "Order total after discount must be at least $0.50 for card payment. Use Cash at Pickup instead." });
    return;
  }

  const baseUrl = process.env.STORE_BASE_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}/store`;

  const stripeLineItems = orderData.lineItems.map((li) => ({
    price_data: {
      currency: "cad",
      product_data: { name: li.productName },
      unit_amount: li.unitPriceInCents,
    },
    quantity: li.quantity,
  }));

  let discountsParam: Stripe.Checkout.SessionCreateParams["discounts"] | undefined;
  let allowPromoCodes = true;

  if (stripePromotionCodeId) {
    discountsParam = [{ promotion_code: stripePromotionCodeId }];
    allowPromoCodes = false;
  } else if (appliedCouponCode) {
    const [couponForStripe] = await db
      .select({ stripeCouponId: couponsTable.stripeCouponId })
      .from(couponsTable)
      .where(eq(couponsTable.code, appliedCouponCode))
      .limit(1);
    if (couponForStripe?.stripeCouponId) {
      discountsParam = [{ coupon: couponForStripe.stripeCouponId }];
      allowPromoCodes = false;
    }
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ["card"],
    line_items: stripeLineItems,
    mode: "payment",
    customer_email: customerEmail,
    success_url: `${baseUrl}/order-confirmation?stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout`,
    ...(discountsParam ? { discounts: discountsParam } : { allow_promotion_codes: allowPromoCodes }),
  };

  const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

  await db.insert(stripePendingCheckoutsTable).values({
    stripeSessionId: checkoutSession.id,
    customerId: session.customerId ?? null,
    customerName,
    customerEmail,
    customerPhone,
    notes: notes ?? null,
    cartSnapshot: orderData.lineItems,
    totalInCents: totalAfterDiscount,
    appliedCouponCode,
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

  const hasDeposits = orderData.lineItems.some((li) => li.pricingType === "deposit");
  if (hasDeposits) {
    res.status(400).json({
      error: "Your cart contains preorder deposits, which require card payment. Please complete checkout with a card.",
    });
    return;
  }

  const { name: customerName, email: customerEmail, phone: customerPhone, notes } = parsed.data;

  let discountAmountCents = 0;
  let cashCouponCode: string | null = null;

  const sessionCouponCodeCash: string | undefined = session.appliedCouponCode;
  if (sessionCouponCodeCash) {
    const couponResult = await validateCoupon(sessionCouponCodeCash, orderData.totalInCents);
    if (couponResult) {
      discountAmountCents = couponResult.discountAmountCents;
      cashCouponCode = couponResult.coupon.code;
    }
  }

  const totalAfterDiscount = Math.max(0, orderData.totalInCents - discountAmountCents);

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
    totalInCents: totalAfterDiscount,
    lineItems: orderData.lineItems,
    claimToken,
    claimTokenExpiresAt,
    appliedCouponCode: cashCouponCode,
  });
  // Note: cash coupon redemption is counted when admin marks the order fulfilled

  session.cart = [];
  session.appliedCouponCode = null;
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
