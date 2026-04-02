import { useRoute, Link, useLocation } from "wouter";
import { useGetMyOrder, getGetMyOrderQueryKey, useAuthMe, getAuthMeQueryKey } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2, ArrowLeft, Package, MapPin, AlertCircle, Calendar } from "lucide-react";
import { useEffect } from "react";

export default function OrderDetail() {
  const [, params] = useRoute("/account/orders/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();

  const { data: session, isLoading: sessionLoading } = useAuthMe({
    query: { queryKey: getAuthMeQueryKey(), retry: false }
  });

  const { data: order, isLoading, isError } = useGetMyOrder(id, {
    query: { 
      queryKey: getGetMyOrderQueryKey(id),
      enabled: !!id && !!session?.id
    }
  });

  useEffect(() => {
    if (!sessionLoading && !session?.id) {
      setLocation("/auth/login");
    }
  }, [sessionLoading, session, setLocation]);

  if (isLoading || sessionLoading) {
    return <div className="flex-1 flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (isError || !order) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-2xl font-serif font-bold mb-4">Order not found</h2>
        <Link href="/account" className="text-primary hover:underline">Back to Account</Link>
      </div>
    );
  }

  const hasDeposits = order.items.some(i => i.pricingType === 'deposit');

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
      <Link href="/account" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Account
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-6 border-b border-border gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Order #{order.id.toString().padStart(5, '0')}</h1>
          <p className="text-muted-foreground mt-1">Placed on {format(new Date(order.createdAt), "MMMM d, yyyy 'at' h:mm a")}</p>
        </div>
        <div className={`inline-flex px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-sm border
          ${order.status === 'pending_payment' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 
            order.status === 'cancelled' ? 'bg-red-50 border-red-200 text-red-800' : 
            'bg-green-50 border-green-200 text-green-800'}`}
        >
          Status: {order.status.replace('_', ' ')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">Customer Details</h3>
          <p className="font-medium text-foreground">{order.customerName}</p>
          <p className="text-foreground/80">{order.customerEmail}</p>
          <p className="text-foreground/80">{order.customerPhone}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">Payment Info</h3>
          <p className="font-medium text-foreground capitalize">{order.paymentMethod} Payment</p>
          <p className="text-foreground/80">Total: {formatMoney(order.totalInCents)}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">Fulfillment</h3>
          <p className="font-medium text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Local Pickup
          </p>
          {order.pickupEventName ? (
            <div className="mt-2 flex items-start gap-1.5 text-sm text-foreground/80">
              <Calendar className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <div>
                <div className="font-medium">{order.pickupEventName}</div>
                {order.pickupEventScheduledAt && (
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(order.pickupEventScheduledAt), "EEEE, MMM d, yyyy")}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/80 mt-2">Watch your email for scheduling.</p>
          )}
        </div>
      </div>

      {hasDeposits && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 mb-8 flex gap-3">
          <AlertCircle className="w-5 h-5 text-accent shrink-0" />
          <p className="text-sm text-foreground/90">
            This order contains preorder deposits. The final price will be calculated based on the actual weight of the products. We will email you an invoice for the final balance the day before pickup.
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-3xl overflow-hidden">
        <div className="p-6 bg-muted/30 border-b border-border">
          <h3 className="font-serif text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Order Items
          </h3>
        </div>
        
        <div className="divide-y divide-border">
          {order.items.map(item => (
            <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <h4 className="font-bold text-lg text-foreground">{item.productName}</h4>
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Qty: {item.quantity}</span>
                  <span>Price: {formatMoney(item.unitPriceInCents)} {item.unitLabel ? `/ ${item.unitLabel}` : ''}</span>
                  {item.pricingType === 'deposit' && <span className="text-accent font-medium">Deposit Item</span>}
                  {item.isGiblets && <span className="text-foreground/80 font-medium">+ Giblets ($2.00)</span>}
                </div>
              </div>
              <div className="font-bold text-xl text-foreground sm:text-right">
                {formatMoney(item.lineTotalInCents)}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-muted/10 border-t border-border flex justify-between items-center">
          <span className="font-bold text-lg">Total Paid</span>
          <span className="font-bold text-2xl text-primary">{formatMoney(order.totalInCents)}</span>
        </div>
      </div>
    </div>
  );
}
