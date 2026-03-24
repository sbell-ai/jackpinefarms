import { Router, type IRouter } from "express";
import { eq, lt } from "drizzle-orm";
import { db, ordersTable, stripePendingCheckoutsTable, customerCartsTable } from "@workspace/db";
import { createOrderFromData, generateClaimToken } from "./checkout.js";

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

      const order = await createOrderFromData({
        customerId: pending.customerId ?? null,
        customerName: pending.customerName,
        customerEmail: pending.customerEmail,
        customerPhone: pending.customerPhone,
        notes: pending.notes,
        paymentMethod: "stripe",
        status: "deposit_paid",
        totalInCents: pending.totalInCents,
        stripeCheckoutSessionId: stripeSessionId,
        stripePaymentIntentId: checkoutSession.payment_intent ?? null,
        lineItems,
        claimToken,
        claimTokenExpiresAt,
      });

      await db
        .delete(stripePendingCheckoutsTable)
        .where(eq(stripePendingCheckoutsTable.stripeSessionId, stripeSessionId));

      if (pending.customerId) {
        await db
          .delete(customerCartsTable)
          .where(eq(customerCartsTable.customerId, pending.customerId));
      }

      const baseUrl = process.env.STORE_BASE_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}/store`;
      const emailParams = encodeURIComponent(pending.customerEmail);
      const accountClaimLine = claimToken
        ? `\n  Claim this order into your account: ${baseUrl}/auth/claim-order?token=${claimToken}`
        : `\n  Order detail: ${baseUrl}/account/orders/${order.id}`;
      const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${emailParams}`;
      console.log(`[EMAIL STUB] Stripe payment confirmed for ${pending.customerEmail}:\n  Order #${String(order.id).padStart(6, "0")} (deposit paid)${accountClaimLine}\n  Unsubscribe: ${unsubscribeUrl}`);
      console.log(`Order ${order.id} created from Stripe session ${stripeSessionId}`);
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

export default router;
