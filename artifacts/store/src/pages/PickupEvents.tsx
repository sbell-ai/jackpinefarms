import { Link } from "wouter";
import { useListPublicPickupEvents } from "@workspace/api-client-react";
import { formatPickupDate } from "@/lib/utils";
import { Calendar, MapPin, Users, ShoppingCart, Loader2 } from "lucide-react";

export default function PickupEventsPage() {
  const { data: events = [], isLoading } = useListPublicPickupEvents();

  return (
    <div className="flex-1 bg-muted/20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-serif font-bold text-foreground mb-3">Pickup Events</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            All orders from Jack Pine Farm are pickup-only. Browse upcoming pickup dates below and select one during checkout.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-3xl">
            <Calendar className="w-14 h-14 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No pickup events available</h2>
            <p className="text-muted-foreground mb-6">
              No pickup events are currently scheduled. Check back soon or <Link href="/contact" className="underline underline-offset-2 hover:text-foreground transition-colors">contact us</Link> to arrange a pickup.
            </p>
            <Link href="/shop" className="inline-block px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const spotsLeft = event.spotsRemaining;

              return (
                <div
                  key={event.id}
                  className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">{event.name}</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                          {formatPickupDate(event.scheduledAt, { includeTime: true })}
                        </p>
                        {event.locationNotes && (
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {event.locationNotes}
                          </p>
                        )}
                        {spotsLeft !== null && spotsLeft <= 5 && (
                          <p className="text-sm mt-1 flex items-center gap-1.5 font-medium text-amber-600">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            Only {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} remaining
                          </p>
                        )}
                      </div>
                    </div>
                    <Link
                      href="/shop"
                      className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Order Now
                    </Link>
                  </div>
                </div>
              );
            })}

            <div className="mt-8 p-5 bg-background border border-border rounded-2xl text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">How it works</p>
              <p>Select a pickup event during checkout to reserve your slot. You will receive an email confirmation with full pickup details.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
