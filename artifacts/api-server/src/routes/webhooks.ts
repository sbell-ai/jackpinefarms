import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";

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
    const orderId = checkoutSession.metadata?.orderId;

    if (orderId) {
      await db
        .update(ordersTable)
        .set({
          status: "deposit_paid",
          stripePaymentIntentId: checkoutSession.payment_intent ?? null,
        })
        .where(eq(ordersTable.id, Number(orderId)));

      console.log(`Order ${orderId} marked as deposit_paid via Stripe webhook`);
    }
  }

  res.json({ received: true });
});

export default router;
