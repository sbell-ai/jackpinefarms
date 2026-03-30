import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useGetCart, getGetCartQueryKey, 
  useRemoveCartItem, 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@/lib/utils";
import { Loader2, Trash2, ArrowRight, ShoppingBag, Plus, Minus } from "lucide-react";

type CartItem = {
  productId: number;
  productName: string;
  productType: string;
  pricingType: "unit" | "deposit";
  unitPriceInCents: number;
  isOnSale: boolean;
  originalPriceInCents: number;
  quantity: number;
  addGiblets: boolean;
  lineTotalInCents: number;
  unitLabel: string | null;
  imageUrl?: string | null;
};


export default function Cart() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: rawCart, isLoading } = useGetCart({
    query: { queryKey: getGetCartQueryKey() }
  });

  const cart = rawCart as { items: CartItem[]; subtotalInCents: number; itemCount: number } | undefined;

  const removeMutation = useRemoveCartItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() })
    }
  });

  const [updatePending, setUpdatePending] = useState(false);
  const handleUpdateQuantity = async (productId: number, newQty: number, addGiblets: boolean) => {
    if (newQty < 1) return;
    setUpdatePending(true);
    try {
      await fetch(`/api/cart/items/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity: newQty, addGiblets }),
      });
      await queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
    } finally {
      setUpdatePending(false);
    }
  };

  const handleRemove = (productId: number) => {
    removeMutation.mutate({ productId });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-20 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6 text-muted-foreground">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-foreground mb-4">Your cart is empty</h1>
        <p className="text-muted-foreground mb-8 text-lg">Looks like you haven't added anything to your cart yet.</p>
        <Link 
          href="/shop" 
          className="px-8 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const hasDeposits = cart.items.some(i => i.pricingType === "deposit");

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 md:py-16">
      <h1 className="text-4xl font-serif font-bold text-foreground mb-8">Your Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          {cart.items.map((item) => (
            <div key={item.productId} className="flex flex-col sm:flex-row gap-6 p-6 bg-card border border-border rounded-2xl shadow-sm relative">
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-serif text-xl font-bold text-foreground">{item.productName}</h3>
                  <button 
                    onClick={() => handleRemove(item.productId)}
                    disabled={removeMutation.isPending}
                    className="text-muted-foreground hover:text-destructive p-2 -mr-2 transition-colors disabled:opacity-50"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-baseline gap-2 mb-4 flex-wrap">
                  {item.isOnSale ? (
                    <>
                      <span className="font-bold text-lg text-red-600 dark:text-red-400">{formatMoney(item.unitPriceInCents)}</span>
                      {item.unitLabel && <span className="text-sm text-muted-foreground">/ {item.unitLabel}</span>}
                      <span className="text-sm text-muted-foreground line-through">{formatMoney(item.originalPriceInCents)}</span>
                      <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full">Sale</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-lg text-primary">{formatMoney(item.unitPriceInCents)}</span>
                      {item.unitLabel && <span className="text-sm text-muted-foreground">/ {item.unitLabel}</span>}
                    </>
                  )}
                  {item.pricingType === "deposit" && (
                    <span className="ml-2 px-2 py-0.5 bg-accent/10 text-accent text-xs font-bold uppercase tracking-wider rounded-md">
                      Deposit
                    </span>
                  )}
                </div>

                {item.pricingType !== "deposit" && (
                  <div className="flex items-center gap-4 mt-auto pt-4 border-t border-border/50">
                    <span className="text-sm font-medium text-foreground">
                      {item.unitLabel === "dozen" ? "Dozens:" : item.unitLabel === "half-dozen" ? "Half-dozens:" : "Quantity:"}
                    </span>
                    <div className="flex items-center bg-background border border-border rounded-lg p-0.5">
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, Math.max(1, item.quantity - 1), item.addGiblets)}
                        disabled={updatePending || item.quantity <= 1}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1, item.addGiblets)}
                        disabled={updatePending}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {item.unitLabel === "dozen" && (
                      <span className="text-xs text-muted-foreground">
                        sold by the dozen (12 eggs each)
                      </span>
                    )}
                    {item.unitLabel === "half-dozen" && (
                      <span className="text-xs text-muted-foreground">
                        sold by the half-dozen (6 eggs each)
                      </span>
                    )}
                  </div>
                )}

                {item.pricingType === "deposit" && (
                  <div className="mt-auto pt-4 border-t border-border/50 space-y-3">
                    <div className="text-sm text-muted-foreground">1 Deposit reserved</div>
                    <label className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        checked={item.addGiblets}
                        onChange={(e) => handleUpdateQuantity(item.productId, item.quantity, e.target.checked)}
                        disabled={updatePending}
                      />
                      <span className="text-sm font-medium">Add Giblets (+{formatMoney(200)}) <span className="text-xs font-normal text-green-600 dark:text-green-400">refundable</span></span>
                    </label>
                  </div>
                )}
              </div>
              <div className="hidden sm:flex items-end font-bold text-xl text-foreground">
                {formatMoney(item.lineTotalInCents)}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-3xl p-8 shadow-sm sticky top-28">
            <h3 className="font-serif text-2xl font-bold text-foreground mb-6">Summary</h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-muted-foreground">
                <span>Items ({cart.itemCount})</span>
                <span>{formatMoney(cart.subtotalInCents)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxes & Fees</span>
                <span>Calculated at pickup</span>
              </div>
            </div>

            <div className="pt-6 border-t border-border mb-8">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-bold text-lg">Total Due Now</span>
                <span className="font-bold text-3xl text-primary">{formatMoney(cart.subtotalInCents)}</span>
              </div>
              {hasDeposits && (
                <p className="text-xs text-accent font-medium bg-accent/5 p-2 rounded text-center border border-accent/10">
                  Final balance for preorders will be invoiced before pickup.
                </p>
              )}
            </div>

            <Link 
              href="/checkout"
              className="w-full flex justify-center items-center gap-2 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg group"
            >
              Proceed to Checkout
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
