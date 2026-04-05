import { Router, type IRouter } from "express";
import { eq, lt, sql } from "drizzle-orm";
import { db, ordersTable, stripePendingCheckoutsTable, customerCartsTable, couponsTable, farmopsTenantsTable } from "@workspace/db";
import { createOrderFromData, generateClaimToken } from "./checkout.js";
import { sendEmail } from "../lib/email.js";
import { getStripe } from "../lib/farmops-stripe.js";

const router: IRouter = Router();

router.post("/webhooks/stripe", async (req, res): Promise<void> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    res.status(200).json({ received: true });
    return;
  }

  let event: any;

  const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));

  if (webhookSecret) {
    const sig = req.headers["stripe-signature"] as string;
    try {
      const Stripe = require("stripe");
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Stripe webhook signature verification failed:", err.message);
      res.status(400).json({ error: `Webhook error: ${err.message}` });
      return;
    }
  } else {
    try {
      event = typeof req.body === "object" ? req.body : JSON.parse(rawBody.toString());
    } catch {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
  }

  // Opportunistically purge pending checkouts older than 25 hours (sessions expire at 24h)
  db.delete(stripePendingCheckoutsTable)
    .where(lt(stripePendingCheckoutsTable.createdAt, new Date(Date.now() - 25 * 60 * 60 * 1000)))
    .catch((e: unknown) => console.warn("Stale pending checkout cleanup error:", e));

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object;
    const stripeSessionId: string = checkoutSession.id;

    // Only fulfil if payment was actually collected
    if (checkoutSession.payment_status !== "paid") {
      console.warn(`[Webhook] Session ${stripeSessionId} completed but payment_status is ${checkoutSession.payment_status} — skipping fulfilment`);
      res.json({ received: true });
      return;
    }

    const [pending] = await db
      .select()
      .from(stripePendingCheckoutsTable)
      .where(eq(stripePendingCheckoutsTable.stripeSessionId, stripeSessionId))
      .limit(1);

    if (pending) {
      const lineItems = pending.cartSnapshot as Array<{
        productId: number;
        productName: string;
        quantity: number;
        pricingType: string;
        unitPriceInCents: number;
        unitLabel: string | null;
        isGiblets: boolean;
        lineTotalInCents: number;
      }>;

      const isGuest = !pending.customerId;
      const claimToken = isGuest ? generateClaimToken() : null;
      const claimTokenExpiresAt = claimToken ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

      // Use Stripe's actual charged amount as source of truth (covers Stripe-entered codes too)
      const actualTotalInCents = checkoutSession.amount_total ?? pending.totalInCents;

      const order = await createOrderFromData({
        customerId: pending.customerId ?? null,
        customerName: pending.customerName,
        customerEmail: pending.customerEmail,
        customerPhone: pending.customerPhone,
        notes: pending.notes,
        paymentMethod: "stripe",
        status: "deposit_paid",
        totalInCents: actualTotalInCents,
        stripeCheckoutSessionId: stripeSessionId,
        stripePaymentIntentId: checkoutSession.payment_intent ?? null,
        lineItems,
        claimToken,
        claimTokenExpiresAt,
        appliedCouponCode: pending.appliedCouponCode ?? null,
        pickupEventId: pending.pickupEventId ?? null,
      });

      await db
        .delete(stripePendingCheckoutsTable)
        .where(eq(stripePendingCheckoutsTable.stripeSessionId, stripeSessionId));

      if (pending.customerId) {
        await db
          .delete(customerCartsTable)
          .where(eq(customerCartsTable.customerId, pending.customerId));
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const amountDiscount: number = checkoutSession.total_details?.amount_discount ?? 0;
      if (amountDiscount > 0) {
        if (pending.appliedCouponCode) {
          // Pre-applied code: increment by the stored code
          db.update(couponsTable)
            .set({ redemptionsCount: sql`${couponsTable.redemptionsCount} + 1` })
            .where(eq(couponsTable.code, pending.appliedCouponCode))
            .catch((e: unknown) => console.warn("[Webhook] Coupon redemption increment failed:", e));
        } else {
          // Stripe-page-entered code: look up via promotion code ID from session
          const sessionDiscounts: Array<{ promotion_code?: string | { id: string } }> =
            checkoutSession.discounts ?? [];
          const rawPromoCode = sessionDiscounts[0]?.promotion_code;
          const promoCodeId =
            typeof rawPromoCode === "string"
              ? rawPromoCode
              : typeof rawPromoCode === "object" && rawPromoCode !== null
                ? rawPromoCode.id
                : null;
          if (promoCodeId) {
            db.update(couponsTable)
              .set({ redemptionsCount: sql`${couponsTable.redemptionsCount} + 1` })
              .where(eq(couponsTable.stripePromotionCodeId, promoCodeId))
              .catch((e: unknown) => console.warn("[Webhook] Stripe-entered promo code redemption failed:", e));
          }
        }
      }

      const baseUrl = process.env.STORE_BASE_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}/store`;
      const orderNum = `#${String(order.id).padStart(6, "0")}`;
      const totalFormatted = `$${(actualTotalInCents / 100).toFixed(2)}`;
      const claimUrl = claimToken
        ? `${baseUrl}/auth/claim-order?token=${claimToken}`
        : `${baseUrl}/account/orders/${order.id}`;
      const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(pending.customerEmail)}`;

      const itemLines = lineItems.map((li) => {
        const price = `$${(li.unitPriceInCents / 100).toFixed(2)}`;
        const lineTotal = `$${(li.lineTotalInCents / 100).toFixed(2)}`;
        const label = li.unitLabel ? ` / ${li.unitLabel}` : "";
        return `  ${li.productName} × ${li.quantity} @ ${price}${label} = ${lineTotal}`;
      });

      const accountLine = claimToken
        ? `To track your order, claim it into an account:\n${claimUrl}`
        : `View your order online:\n${claimUrl}`;

      const textBody = [
        `Hi ${pending.customerName},`,
        ``,
        `Thank you for your order from Jack Pine Farm! Your deposit has been received.`,
        ``,
        `Order ${orderNum}`,
        `─────────────────────────`,
        ...itemLines,
        `─────────────────────────`,
        `Total paid: ${totalFormatted}`,
        ``,
        `We'll be in touch to confirm your pickup details.`,
        ``,
        accountLine,
        ``,
        `Questions? Reply to this email.`,
        ``,
        `— Jack Pine Farm`,
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
    <h1>Jack Pine Farm</h1>
    <p>Order confirmation</p>
  </div>
  <div class="body">
    <p>Hi ${pending.customerName},</p>
    <p>Thank you for your order! Your deposit has been received and we&rsquo;ll be in touch to confirm your pickup details.</p>
    <p class="order-num">Order ${orderNum} &mdash; Deposit paid: ${totalFormatted}</p>
    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Total</th></tr></thead>
      <tbody>
        ${lineItems.map((li) => `<tr>
          <td>${li.productName}${li.unitLabel ? ` <span style="color:#9e9890;font-size:12px;">/ ${li.unitLabel}</span>` : ""}</td>
          <td class="right">${li.quantity}</td>
          <td class="right">$${(li.lineTotalInCents / 100).toFixed(2)}</td>
        </tr>`).join("")}
        <tr class="total-row"><td colspan="2">Total paid</td><td class="right">${totalFormatted}</td></tr>
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

      const emailResult = await sendEmail({
        to: pending.customerEmail,
        subject: `Order ${orderNum} confirmed — Jack Pine Farm`,
        text: textBody,
        html: htmlBody,
      });
      console.log(`Order ${order.id} created from Stripe session ${stripeSessionId} | email: ${emailResult.provider}${emailResult.sent ? "" : " (stub)"}`);
    } else {
      console.warn(`No pending checkout found for Stripe session ${stripeSessionId}`);
    }
  } else if (event.type === "payment_intent.succeeded") {
    // Orders are created via checkout.session.completed which carries full context.
    // This event is a safe no-op; session.completed always fires alongside it.
    console.log(`[Webhook] payment_intent.succeeded for ${(event.data.object as any).id} — order handled via session.completed`);
  } else if (event.type === "payment_intent.payment_failed") {
    // A payment attempt failed inside an open Checkout Session.
    // The session remains open so the customer can retry — we do not delete
    // the pending checkout here. If the session eventually expires without
    // success, checkout.session.expired will fire and clean it up.
    // Stale rows are also pruned by the opportunistic cleanup above.
    console.log(`[Webhook] payment_intent.payment_failed for ${(event.data.object as any).id} — no action needed`);
  } else if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const checkoutSession = event.data.object;
    const stripeSessionId: string = checkoutSession.id;

    await db
      .delete(stripePendingCheckoutsTable)
      .where(eq(stripePendingCheckoutsTable.stripeSessionId, stripeSessionId));

    console.log(`Pending checkout ${stripeSessionId} removed due to ${event.type}`);
  }

  res.json({ received: true });
});

// ── POST /webhooks/farmops-stripe ─────────────────────────────────────────────
// Handles FarmOps SaaS subscription lifecycle events from Stripe.
// Uses a separate webhook secret (FARMOPS_STRIPE_WEBHOOK_SECRET) so that
// Jack Pine storefront webhooks and FarmOps billing webhooks can be registered
// as distinct Stripe webhook endpoints with different event filters.

async function updateTenantFromSubscription(
  subscription: any,
  logger: typeof console
): Promise<void> {
  // Prefer metadata set on the subscription; fall back to customer lookup.
  const tenantIdStr: string | undefined =
    subscription.metadata?.farmopsTenantId;

  let tenantId: number | undefined = tenantIdStr ? parseInt(tenantIdStr, 10) : undefined;

  if (!tenantId && subscription.customer) {
    // Fall back: look up tenant by Stripe customer ID
    const [t] = await db
      .select({ id: farmopsTenantsTable.id })
      .from(farmopsTenantsTable)
      .where(eq(farmopsTenantsTable.stripeCustomerId, subscription.customer))
      .limit(1);
    tenantId = t?.id;
  }

  if (!tenantId) {
    logger.warn("[FarmOps webhook] Could not resolve tenantId from subscription", {
      subscriptionId: subscription.id,
    });
    return;
  }

  // Derive our status from Stripe's subscription status
  const stripeStatus: string = subscription.status;
  const statusMap: Record<string, string> = {
    trialing:         "trialing",
    active:           "active",
    past_due:         "past_due",
    canceled:         "canceled",
    unpaid:           "past_due",
    paused:           "paused",
    incomplete:       "past_due",
    incomplete_expired: "canceled",
  };
  const ourStatus = statusMap[stripeStatus] ?? "past_due";

  // Derive our plan from the subscription's price metadata or item lookup
  const planFromMeta = subscription.metadata?.plan as string | undefined;
  const validPlans = ["starter", "growth", "pro"];
  const ourPlan = validPlans.includes(planFromMeta ?? "") ? planFromMeta : undefined;

  const currentPeriodEndsAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : undefined;

  const update: Partial<typeof farmopsTenantsTable.$inferInsert> = {
    stripeSubscriptionId:      subscription.id,
    stripeSubscriptionStatus:  stripeStatus,
    status:                    ourStatus as any,
    updatedAt:                 new Date(),
  };
  if (ourPlan) update.plan = ourPlan as any;
  if (currentPeriodEndsAt) update.currentPeriodEndsAt = currentPeriodEndsAt;
  if (subscription.trial_end) update.trialEndsAt = new Date(subscription.trial_end * 1000);

  await db
    .update(farmopsTenantsTable)
    .set(update)
    .where(eq(farmopsTenantsTable.id, tenantId));

  logger.log(`[FarmOps webhook] Tenant ${tenantId} updated: status=${ourStatus}${ourPlan ? ` plan=${ourPlan}` : ""}`);
}

router.post("/webhooks/farmops-stripe", async (req, res): Promise<void> => {
  const webhookSecret = process.env.FARMOPS_STRIPE_WEBHOOK_SECRET;
  const stripeKey     = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    // Stripe not configured — ack silently
    res.status(200).json({ received: true });
    return;
  }

  const stripe = getStripe()!;
  const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
  let event: any;

  if (webhookSecret) {
    const sig = req.headers["stripe-signature"] as string;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("[FarmOps webhook] Signature verification failed:", err.message);
      res.status(400).json({ error: `Webhook error: ${err.message}` });
      return;
    }
  } else {
    try {
      event = typeof req.body === "object" ? req.body : JSON.parse(rawBody.toString());
    } catch {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }
  }

  const obj = event.data.object;

  switch (event.type) {
    // ── Subscription created / updated ──────────────────────────────────────
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await updateTenantFromSubscription(obj, console);
      break;

    // ── Subscription cancelled ───────────────────────────────────────────────
    case "customer.subscription.deleted":
      await updateTenantFromSubscription({ ...obj, status: "canceled" }, console);
      break;

    // ── Invoice paid — confirm active and update period end ──────────────────
    case "invoice.payment_succeeded": {
      const subscriptionId: string | undefined = obj.subscription;
      if (subscriptionId) {
        // Re-fetch subscription to get latest period & plan info
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await updateTenantFromSubscription(subscription, console);
      }
      break;
    }

    // ── Invoice payment failed — mark past_due ───────────────────────────────
    case "invoice.payment_failed": {
      const subscriptionId: string | undefined = obj.subscription;
      if (subscriptionId) {
        const [tenant] = await db
          .select({ id: farmopsTenantsTable.id })
          .from(farmopsTenantsTable)
          .where(eq(farmopsTenantsTable.stripeSubscriptionId, subscriptionId))
          .limit(1);
        if (tenant) {
          await db
            .update(farmopsTenantsTable)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(farmopsTenantsTable.id, tenant.id));
          console.log(`[FarmOps webhook] Tenant ${tenant.id} marked past_due`);
        }
      }
      break;
    }

    // ── One-time payment for onboarding add-on ───────────────────────────────
    case "checkout.session.completed": {
      const metadata = obj.metadata ?? {};
      if (
        metadata.type === "farmops_onboarding" &&
        obj.payment_status === "paid" &&
        metadata.farmopsTenantId
      ) {
        const tenantId = parseInt(metadata.farmopsTenantId, 10);
        await db
          .update(farmopsTenantsTable)
          .set({
            onboardingPurchasedAt:     new Date(),
            stripeOnboardingPaymentId: obj.payment_intent ?? null,
            updatedAt:                 new Date(),
          })
          .where(eq(farmopsTenantsTable.id, tenantId));
        console.log(`[FarmOps webhook] Tenant ${tenantId} onboarding purchased`);
      }

      // FarmOps subscription checkout — sync the new subscription
      if (
        metadata.type === "farmops_subscription" &&
        obj.subscription &&
        metadata.farmopsTenantId
      ) {
        const subscription = await stripe.subscriptions.retrieve(obj.subscription);
        await updateTenantFromSubscription(subscription, console);
      }
      break;
    }

    default:
      // Unhandled event — ack silently
      break;
  }

  res.json({ received: true });
});

export default router;
