import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, stripePendingCheckoutsTable } from "@workspace/db";
import { createOrderFromData } from "./checkout.js";

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

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object;
    const stripeSessionId: string = checkoutSession.id;

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
      });

      await db
        .delete(stripePendingCheckoutsTable)
        .where(eq(stripePendingCheckoutsTable.stripeSessionId, stripeSessionId));

      console.log(`[EMAIL STUB] Stripe payment confirmed for ${pending.customerEmail}:\n  Order #${String(order.id).padStart(6, "0")} (deposit paid)`);
      console.log(`Order ${order.id} created from Stripe session ${stripeSessionId}`);
    } else {
      console.warn(`No pending checkout found for Stripe session ${stripeSessionId}`);
    }
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
