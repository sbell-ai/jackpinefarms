import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CircleCheck, Package, MapPin, Calendar, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { getGetCartQueryKey } from "@workspace/api-client-react";
import { useStoreTenant } from "@/lib/StoreTenantContext";

interface OrderSummary {
  id: number;
  pickupEventName?: string | null;
  pickupEventScheduledAt?: string | null;
}

export default function OrderConfirmation() {
  const searchParams = new URLSearchParams(window.location.search);
  const orderId = searchParams.get("id");
  const stripeSessionId = searchParams.get("stripe_session_id");

  const queryClient = useQueryClient();
  const { tenant } = useStoreTenant();
  const farmName = tenant?.name ?? "Jack Pine Farm";
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  useEffect(() => {
    if (!stripeSessionId && !orderId) return;

    if (!stripeSessionId && orderId) {
      const storedName = sessionStorage.getItem("pendingPickupEventName");
      const storedDate = sessionStorage.getItem("pendingPickupEventScheduledAt");
      sessionStorage.removeItem("pendingPickupEventName");
      sessionStorage.removeItem("pendingPickupEventScheduledAt");

      fetch(`/api/orders/${orderId}`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setOrder(data);
          } else if (storedName) {
            setOrder({ id: Number(orderId), pickupEventName: storedName, pickupEventScheduledAt: storedDate });
          } else {
            setOrder({ id: Number(orderId) });
          }
          setLookupDone(true);
        })
        .catch(() => {
          if (storedName) {
            setOrder({ id: Number(orderId), pickupEventName: storedName, pickupEventScheduledAt: storedDate });
          } else {
            setOrder({ id: Number(orderId) });
          }
          setLookupDone(true);
        });
      return;
    }

    fetch("/api/cart/clear", { method: "POST", credentials: "include" }).then(() => {
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
    });

    let attempts = 0;
    const maxAttempts = 10;
    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/orders/by-stripe-session/${stripeSessionId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
          setLookupDone(true);
          return;
        }
      } catch {}
      if (attempts < maxAttempts) {
        setTimeout(poll, 1500);
      } else {
        setLookupDone(true);
      }
    };
    poll();
  }, [stripeSessionId, orderId]);

  const displayOrderId = order?.id ?? (orderId ? Number(orderId) : null);
  const isLoading = (stripeSessionId || orderId) && !lookupDone;

  return (
    <div className="flex-1 bg-muted/20 flex items-center justify-center py-16 px-4">
      <div className="max-w-2xl w-full bg-card border border-border rounded-3xl p-8 md:p-12 shadow-xl text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CircleCheck className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="text-4xl font-serif font-bold text-foreground mb-4">Order Confirmed!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Thank you for supporting {farmName}. Your order has been successfully placed.
        </p>

        {isLoading ? (
          <div className="inline-flex items-center gap-2 bg-muted px-6 py-3 rounded-xl font-mono text-lg font-bold text-foreground mb-10 border border-border">
            <Loader2 className="w-4 h-4 animate-spin" />
            Looking up your order…
          </div>
        ) : displayOrderId ? (
          <div className="inline-block bg-muted px-6 py-3 rounded-xl font-mono text-lg font-bold text-foreground mb-10 border border-border">
            Order #{String(displayOrderId).padStart(6, '0')}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left">
          <div className="p-5 rounded-2xl bg-background border border-border">
            <Package className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-bold text-sm uppercase tracking-wider mb-1">Status</h3>
            <p className="text-muted-foreground">Order received. We will email you a final confirmation.</p>
          </div>
          
          <div className="p-5 rounded-2xl bg-background border border-border">
            <MapPin className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-bold text-sm uppercase tracking-wider mb-1">Pickup Location</h3>
            <p className="text-muted-foreground">{farmName}<br/>(Address in email)</p>
          </div>

          <div className="p-5 rounded-2xl bg-background border border-border">
            <Calendar className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-bold text-sm uppercase tracking-wider mb-1">Pickup Date</h3>
            {order?.pickupEventName ? (
              <div>
                <p className="font-semibold text-foreground text-sm">{order.pickupEventName}</p>
                {order.pickupEventScheduledAt && (
                  <p className="text-muted-foreground text-sm mt-0.5">
                    {format(new Date(order.pickupEventScheduledAt), "EEEE, MMM d, yyyy")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Watch your email for pickup scheduling details.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/account" className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-md">
            View Order Status
          </Link>
          <Link href="/shop" className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-background border-2 border-border text-foreground font-bold hover:border-primary/50 transition-all">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
