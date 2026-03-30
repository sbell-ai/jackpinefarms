export interface CreateStripeInvoiceParams {
  orderId: number;
  email: string;
  customerName: string;
  remainingCents: number;
  weightLbs: number;
  pricePerLbCents: number;
  depositPaidCents: number;
  eventName: string;
}

export async function createStripeInvoice(
  params: CreateStripeInvoiceParams,
): Promise<string | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;

  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const Stripe = require("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });

  const searchResult = await stripe.customers.list({
    email: params.email,
    limit: 1,
  });
  const stripeCustomer =
    searchResult.data[0] ??
    (await stripe.customers.create({
      email: params.email,
      name: params.customerName,
    }));

  const description = [
    `Jack Pine Farm — Order #${String(params.orderId).padStart(4, "0")} final balance`,
    `${params.weightLbs} lbs × $${(params.pricePerLbCents / 100).toFixed(2)}/lb = $${((params.weightLbs * params.pricePerLbCents) / 100).toFixed(2)}`,
    `Minus deposit paid: $${(params.depositPaidCents / 100).toFixed(2)}`,
    `Pickup: ${params.eventName}`,
  ].join(" | ");

  await stripe.invoiceItems.create({
    customer: stripeCustomer.id,
    amount: params.remainingCents,
    currency: "cad",
    description,
  });

  const invoice = await stripe.invoices.create({
    customer: stripeCustomer.id,
    collection_method: "send_invoice",
    days_until_due: 7,
    auto_advance: true,
  });

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(finalizedInvoice.id);

  return finalizedInvoice.id;
}
