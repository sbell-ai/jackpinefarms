import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Faq() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-serif font-bold text-primary mb-6">Frequently Asked Questions</h1>
        <p className="text-lg text-muted-foreground">Everything you need to know about ordering from Jack Pine Farm.</p>
      </div>

      <div className="space-y-12">
        {/* Store & Ordering */}
        <div>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-6 pb-2 border-b border-border">Ordering & Pickup</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left font-medium text-lg">Do you ship your products?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                No, we operate entirely on a local pickup model. All orders must be picked up directly from the farm during our scheduled pickup events.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left font-medium text-lg">How do preorders and deposits work?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                For our meat chickens and turkeys, we require a deposit to reserve your bird for a specific season or batch. This deposit secures your order. Once the birds are processed and weighed, we calculate the final balance based on the price-per-pound and send you an invoice the day before pickup.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left font-medium text-lg">Are deposits refundable?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                No. Base deposits are non-refundable as they secure live inventory that we raise specifically for you. The only exception is the optional "giblets" add-on deposit, which is refundable if canceled.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Farm Practices */}
        <div>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-6 pb-2 border-b border-border">Our Farming Practices</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left font-medium text-lg">What does "pasture raised" mean to you?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                It means our birds live outside in the open, free to roam in the pasture. They can forage for bugs, seeds, and greens in the sunshine. They get to peck at small stones and gravel to fill their gizzards, which helps their digestion. This is the natural way poultry should live.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left font-medium text-lg">Is your feed Non-GMO?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                Yes. While poultry requires grain to supplement their pasture diet, we exclusively use high-quality, non-GMO feed for all our flocks.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* FarmOps */}
        <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10 mt-16">
          <h2 className="text-2xl font-serif font-bold text-primary mb-4">About FarmOps</h2>
          <p className="text-muted-foreground mb-6">
            Are you a fellow farmer? You might be interested in the software powering this store.
          </p>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-6" className="border-b-0">
              <AccordionTrigger className="text-left font-medium text-lg py-2 hover:no-underline">What is FarmOps?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed pt-2">
                FarmOps is a tool we built initially for Jack Pine Farm to manage our animal inventory, track lineage, and calculate real unit economics (like cost per pound). It's designed for small producers who have outgrown spreadsheets but don't need complex enterprise ag software. We are currently testing it internally before opening it to other producers.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

      </div>
    </div>
  );
}
