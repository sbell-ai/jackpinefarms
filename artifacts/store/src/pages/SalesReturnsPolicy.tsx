export default function SalesReturnsPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
      <div className="mb-12">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-3">Policies</p>
        <h1 className="text-5xl font-serif font-bold text-primary mb-4">Sales &amp; Returns Policy</h1>
        <p className="text-muted-foreground text-sm">Effective date: March 30, 2026</p>
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10 text-foreground">

        <section>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">1. All sales are final</h2>
          <p className="text-muted-foreground leading-relaxed">
            All purchases from Jack Pine Farm are final. We do not accept returns or offer refunds for any products
            once an order is placed, except where required by law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">2. Deposits are non-refundable</h2>
          <p className="text-muted-foreground leading-relaxed">
            Deposits are non-refundable. A deposit reserves product for a specific fulfillment window and helps us
            plan harvest, processing, and inventory.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">3. Pickup-only fulfillment</h2>
          <p className="text-muted-foreground leading-relaxed">
            Orders are for local pickup only. Pickup instructions (date, time, and location) will be provided at
            checkout and in your order confirmation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">4. No-shows and unclaimed orders</h2>
          <p className="text-muted-foreground leading-relaxed">
            If an order is not collected during the scheduled pickup window, we may be unable to hold the product
            while maintaining quality and safety. Unclaimed orders are not eligible for a refund. If the product
            is still safe and available, we may reschedule pickup at our discretion.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">5. Problems with an order</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            If you believe you received the wrong item or there is a quality issue, please contact us within
            24 hours of pickup with:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Your name and order number (if available)</li>
            <li>A short description of the issue</li>
            <li>Photos, if applicable</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Although sales are final, we may offer a replacement or store credit at our discretion when we can
            verify that an issue originated on our side.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">6. Cancellations and changes</h2>
          <p className="text-muted-foreground leading-relaxed">
            Because our products are limited and planning-based, we may not be able to accommodate cancellations
            or changes after an order is placed. If you need help, please contact us as soon as possible and
            we'll do our best — but refunds are not available.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">7. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            Questions about an order or this policy? Reach us at{" "}
            <a
              href="mailto:hello@jackpinefarms.farm"
              className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
            >
              hello@jackpinefarms.farm
            </a>
            {" "}or use the{" "}
            <a href="/contact" className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">
              contact form
            </a>.
          </p>
        </section>

      </div>
    </div>
  );
}
