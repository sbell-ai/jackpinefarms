import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { inArray, eq, sql, count, and, gt } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  productsTable,
  ordersTable,
  orderItemsTable,
  stripePendingCheckoutsTable,
  customerCartsTable,
  couponsTable,
  pickupEventsTable,
  type CartLineItem,
} from "@workspace/db";
import { CreateStripeCheckoutBody, CreateCashOrderBody } from "@workspace/api-zod";
import type Stripe from "stripe";
import { sendEmail } from "../lib/email.js";
import { sendSms } from "../lib/sms.js";
import { resolveStoreTenant } from "../middlewares/resolve-store-tenant.js";

const router: IRouter = Router();

async function validatePickupEvent(pickupEventId: number, tenantId: number): Promise<{ error: string } | null> {
  const now = new Date();
  const [event] = await db
    .select()
    .from(pickupEventsTable)
    .where(
      and(
        eq(pickupEventsTable.id, pickupEventId),
        eq(pickupEventsTable.tenantId, tenantId),
        eq(pickupEventsTable.isPublic, true),
        eq(pickupEventsTable.status, "scheduled"),
        gt(pickupEventsTable.scheduledAt, now)
      )
    )
    .limit(1);

  if (!event) {
    return { error: "The selected pickup date is no longer available. Please refresh and choose another." };
  }

  if (event.capacity != null) {
    const [{ value: assignedCount }] = await db
      .select({ value: count() })
      .from(ordersTable)
      .where(eq(ordersTable.pickupEventId, pickupEventId));
    if (Number(assignedCount) >= event.capacity) {
      return { error: "This pickup date is now full. Please choose a different date." };
    }
  }

  return null;
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

export async function buildOrderItems(
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
  pickupEventId?: number | null;
  tenantId?: number | null;
}) {
  const [order] = await db
    .insert(ordersTable)
    .values({
      tenantId: data.tenantId ?? null,
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
      pickupEventId: data.pickupEventId ?? null,
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

router.post("/checkout/stripe", resolveStoreTenant, async (req, res): Promise<void> => {
  const tenantId = req.storeTenant!.id;
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

  const { name: customerName, email: customerEmail, phone: customerPhone, notes, pickupEventId } = parsed.data;

  const pickupError = await validatePickupEvent(pickupEventId, tenantId);
  if (pickupError) {
    res.status(400).json(pickupError);
    return;
  }

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
    // Always use promotion_code — coupon path is never used
    discountsParam = [{ promotion_code: stripePromotionCodeId }];
    allowPromoCodes = false;
  } else if (appliedCouponCode) {
    // Coupon was applied but has no Stripe promotion code ID.
    // This means the coupon was created before Stripe was configured, or activation failed.
    // We cannot carry the discount through Stripe reliably, so block card checkout.
    res.status(400).json({
      error:
        "Your applied coupon cannot be used with card payment right now. " +
        "Please remove the coupon and try again, or choose Cash at Pickup.",
    });
    return;
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
    tenantId,
    customerId: session.customerId ?? null,
    customerName,
    customerEmail,
    customerPhone,
    notes: notes ?? null,
    cartSnapshot: orderData.lineItems,
    totalInCents: totalAfterDiscount,
    appliedCouponCode,
    pickupEventId: pickupEventId ?? null,
  });

  res.json({ checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id });
});

router.post("/checkout/cash", resolveStoreTenant, async (req, res): Promise<void> => {
  const tenantId = req.storeTenant!.id;
  const farmName = req.storeTenant!.name;
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

  const { name: customerName, email: customerEmail, phone: customerPhone, notes, pickupEventId } = parsed.data;

  const pickupErrorCash = await validatePickupEvent(pickupEventId, tenantId);
  if (pickupErrorCash) {
    res.status(400).json(pickupErrorCash);
    return;
  }

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
    tenantId,
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
    pickupEventId: pickupEventId ?? null,
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
  const orderNum = `#${String(order.id).padStart(6, "0")}`;
  const totalFormatted = `$${(totalAfterDiscount / 100).toFixed(2)}`;
  const claimUrl = claimToken
    ? `${baseUrl}/auth/claim-order?token=${claimToken}`
    : `${baseUrl}/account/orders/${order.id}`;
  const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(customerEmail)}`;

  const itemLines = orderData.lineItems.map((li) => {
    const price = `$${(li.unitPriceInCents / 100).toFixed(2)}`;
    const lineTotal = `$${(li.lineTotalInCents / 100).toFixed(2)}`;
    const label = li.unitLabel ? ` / ${li.unitLabel}` : "";
    return `  ${li.productName} × ${li.quantity} @ ${price}${label} = ${lineTotal}`;
  });

  const accountLine = claimToken
    ? `To track your order, claim it into an account:\n${claimUrl}`
    : `View your order online:\n${claimUrl}`;

  const textBody = [
    `Hi ${customerName},`,
    ``,
    `Thank you for your order from ${farmName}! We'll collect payment at pickup.`,
    ``,
    `Order ${orderNum}`,
    `─────────────────────────`,
    ...itemLines,
    `─────────────────────────`,
    `Total: ${totalFormatted}`,
    ``,
    `We'll be in touch to confirm your pickup details.`,
    ``,
    accountLine,
    ``,
    `Questions? Reply to this email.`,
    ``,
    `— ${farmName}`,
    ``,
    `To unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Georgia, serif; color: #2d2d2d; background: #faf9f7; margin: 0; padding: 0; }
  .wrap { max-width: 560px; margin: 40px auto; background: #ffffff; border: 1px solid #e5e0d8; border-radius: 8px; overflow: hidden; }
  .header { background: #2c4a2e; color: #ffffff; padding: 28px 32px; }
  .header h1 { margin: 0; font-size: 22px; font-weight: normal; letter-spacing: 0.5px; }
  .header p { margin: 4px 0 0; font-size: 14px; opacity: 0.75; }
  .body { padding: 32px; }
  .order-num { font-size: 13px; color: #6b6558; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { text-align: left; font-size: 12px; color: #6b6558; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0; border-bottom: 1px solid #e5e0d8; }
  td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f0ece5; vertical-align: top; }
  td.right { text-align: right; }
  .total-row td { font-weight: bold; font-size: 15px; border-bottom: none; }
  .cta { margin: 28px 0 0; }
  .cta a { display: inline-block; background: #2c4a2e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; }
  .footer { padding: 20px 32px; font-size: 12px; color: #9e9890; border-top: 1px solid #f0ece5; }
  .footer a { color: #9e9890; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>${farmName}</h1>
    <p>Order received — Cash at Pickup</p>
  </div>
  <div class="body">
    <p>Hi ${customerName},</p>
    <p>Thank you for your order! We&rsquo;ll collect payment when you pick up.</p>
    <p class="order-num">Order ${orderNum} &mdash; Total: ${totalFormatted}</p>
    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Total</th></tr></thead>
      <tbody>
        ${orderData.lineItems.map((li) => `<tr>
          <td>${li.productName}${li.unitLabel ? ` <span style="color:#9e9890;font-size:12px;">/ ${li.unitLabel}</span>` : ""}</td>
          <td class="right">${li.quantity}</td>
          <td class="right">$${(li.lineTotalInCents / 100).toFixed(2)}</td>
        </tr>`).join("")}
        <tr class="total-row"><td colspan="2">Total</td><td class="right">${totalFormatted}</td></tr>
      </tbody>
    </table>
    <div class="cta">
      <a href="${claimUrl}">${claimToken ? "Track your order" : "View order"}</a>
    </div>
  </div>
  <div class="footer">
    Questions? Just reply to this email. &nbsp;&middot;&nbsp; <a href="${unsubscribeUrl}">Unsubscribe</a>
  </div>
</div>
</body></html>`;

  // ── [TEMP DEBUG] Email provider diagnostics ──────────────────────────────
  const _dbgProvider = process.env.SENDGRID_API_KEY
    ? "sendgrid"
    : process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? "smtp"
    : "stub";
  const _dbgFrom = process.env.EMAIL_FROM ?? "(not set — falling back to: Jack Pine Farm <noreply@jackpinefarm.ca>)";
  console.log(`[Cash order DEBUG] order=${orderNum} provider=${_dbgProvider} EMAIL_FROM=${_dbgFrom} SMTP_HOST=${process.env.SMTP_HOST ?? "(not set)"} SMTP_USER=${process.env.SMTP_USER ?? "(not set)"} SMTP_PASS=${process.env.SMTP_PASS ? "(set)" : "(not set)"}`);
  // ── [TEMP DEBUG END] ─────────────────────────────────────────────────────

  try {
    const result = await sendEmail({
      to: customerEmail,
      subject: `Order ${orderNum} confirmed — ${farmName}`,
      text: textBody,
      html: htmlBody,
    });
    console.log(`[Cash order DEBUG] customer email result: sent=${result.sent} provider=${result.provider}${result.error ? ` error=${result.error}` : ""}`);
  } catch (err: unknown) {
    console.error(`[Cash order DEBUG] customer email threw:`, err);
  }

  // ── Customer SMS confirmation (fire-and-forget) ──────────────────────────
  if (customerPhone) {
    sendSms({
      to: customerPhone,
      body: `Your order ${orderNum} is confirmed — Cash at Pickup. Thank you! – ${farmName}`,
    }).catch((err: unknown) =>
      console.warn("[Cash order] Customer SMS failed:", err)
    );
  }

  // ── Admin SMS alert (fire-and-forget) ────────────────────────────────────
  const adminPhone = process.env.ADMIN_PHONE;
  if (adminPhone) {
    sendSms({
      to: adminPhone,
      body: `New order ${orderNum} from ${customerName}.\n${orderData.lineItems.length} item(s) — ${totalFormatted}.\nView: jackpinefarms.farm/admin/orders`,
    }).catch((err: unknown) =>
      console.warn("[Cash order] Admin SMS failed:", err)
    );
  } else {
    console.warn("[Cash order] ADMIN_PHONE not set — skipping admin SMS");
  }

  // ── Owner notification (fire-and-forget) ─────────────────────────────────
  const notifyEmail = process.env.ORDER_NOTIFICATION_EMAIL ?? process.env.CONTACT_TO_EMAIL;
  console.log(`[Cash order DEBUG] notifyEmail=${notifyEmail ?? "(not set — skipping owner notification)"}`);
  if (notifyEmail) {
    sendEmail({
      to: notifyEmail,
      subject: `New order received — ${orderNum} from ${customerName}`,
      text: [
        `New order received on ${farmName} store.`,
        ``,
        `Order: ${orderNum}`,
        `Customer: ${customerName} (${customerEmail})`,
        `Payment: Cash at Pickup`,
        `Total: ${totalFormatted}`,
        ``,
        `Items:`,
        ...orderData.lineItems.map((li) => `  ${li.productName} × ${li.quantity} — $${(li.lineTotalInCents / 100).toFixed(2)}`),
      ].join("\n"),
      html: [
        `<p><strong>New order received</strong> on ${farmName} store.</p>`,
        `<p><strong>Order:</strong> ${orderNum}<br>`,
        `<strong>Customer:</strong> ${customerName} (${customerEmail})<br>`,
        `<strong>Payment:</strong> Cash at Pickup<br>`,
        `<strong>Total:</strong> ${totalFormatted}</p>`,
        `<ul>${orderData.lineItems.map((li) => `<li>${li.productName} × ${li.quantity} — $${(li.lineTotalInCents / 100).toFixed(2)}</li>`).join("")}</ul>`,
      ].join("\n"),
    })
      .then((r) => console.log(`[Cash order DEBUG] owner email result: sent=${r.sent} provider=${r.provider}${r.error ? ` error=${r.error}` : ""}`))
      .catch((err: unknown) => console.warn("[Cash order] Owner notification email failed:", err));
  }

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
