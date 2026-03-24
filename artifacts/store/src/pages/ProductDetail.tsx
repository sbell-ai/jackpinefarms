import { useState } from "react";
import { useRoute } from "wouter";
import { useGetProduct, useSubscribeNotifyMe } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/utils";
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function ProductDetail() {
  const [, params] = useRoute("/shop/:id");
  const id = parseInt(params?.id || "0", 10);
  
  const { data: product, isLoading, isError } = useGetProduct(id);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySuccess, setNotifySuccess] = useState(false);
  
  const notifyMutation = useSubscribeNotifyMe();

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail) return;
    
    try {
      await notifyMutation.mutateAsync({
        id,
        data: { email: notifyEmail }
      });
      setNotifySuccess(true);
      setNotifyEmail("");
    } catch (err) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h2 className="text-2xl font-serif font-bold text-foreground mb-4">Product not found</h2>
        <Link href="/shop" className="text-primary hover:underline">Return to Shop</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 w-full">
      <Link href="/shop" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Shop
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
        {/* Images */}
        <div className="rounded-3xl overflow-hidden bg-card border border-border shadow-md">
          <div className="aspect-[4/3] w-full relative">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <img src="https://images.unsplash.com/photo-1516684732162-798a0062be99?w=800&q=80" alt={product.name} className="w-full h-full object-cover" />
            )}
            
            {product.availability === 'sold_out' && (
              <div className="absolute top-6 right-6 bg-foreground text-background px-4 py-2 rounded-full text-sm font-bold tracking-wider shadow-lg">
                Sold Out
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">{product.name}</h1>
          
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-foreground">
              {formatMoney(product.priceInCents)}
            </span>
            {product.unitLabel && (
              <span className="text-xl text-muted-foreground">/ {product.unitLabel}</span>
            )}
          </div>

          <div className="prose prose-p:text-muted-foreground prose-p:leading-relaxed mb-8">
            <p>{product.description}</p>
          </div>

          {/* Deposit Info Box */}
          {product.pricingType === 'deposit' && (
            <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 mb-8">
              <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Preorder Deposit
              </h4>
              <p className="text-sm text-foreground/80 mb-3">
                This is a non-refundable deposit to reserve your order. The final price will be calculated by weight and invoiced before pickup.
              </p>
              {product.depositDescription && (
                <p className="text-sm text-foreground/80 bg-white/50 p-3 rounded-lg border border-accent/10">
                  {product.depositDescription}
                </p>
              )}
            </div>
          )}

          {/* Call to Action Area */}
          <div className="mt-auto border-t border-border pt-8">
            {product.availability === 'taking_orders' && (
              <button disabled className="w-full py-4 rounded-xl bg-primary/50 text-white font-bold text-lg cursor-not-allowed border border-primary/20">
                Add to Cart (Coming Soon)
              </button>
            )}

            {product.availability === 'preorder' && (
              <button disabled className="w-full py-4 rounded-xl bg-accent/50 text-white font-bold text-lg cursor-not-allowed border border-accent/20">
                Place Deposit (Coming Soon)
              </button>
            )}

            {product.availability === 'sold_out' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="font-serif text-xl font-bold text-foreground mb-2">Out of Stock</h3>
                <p className="text-muted-foreground mb-6">Enter your email to be notified when this is back in stock.</p>
                
                {notifySuccess ? (
                  <div className="flex items-center gap-3 text-primary bg-primary/5 p-4 rounded-xl border border-primary/20">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="font-medium">We'll let you know when {product.name} is available again.</span>
                  </div>
                ) : (
                  <form onSubmit={handleNotifySubmit} className="flex gap-3">
                    <input
                      type="email"
                      required
                      placeholder="Email address"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={notifyMutation.isPending}
                      className="px-6 py-3 rounded-xl bg-foreground text-background font-bold hover:bg-foreground/90 transition-colors disabled:opacity-50"
                    >
                      {notifyMutation.isPending ? "Submitting..." : "Notify Me"}
                    </button>
                  </form>
                )}
                {notifyMutation.isError && (
                  <p className="text-destructive text-sm mt-3">Something went wrong. Please try again.</p>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-8 flex gap-6 text-sm text-muted-foreground border-t border-border pt-6">
            <span>✓ Local pickup only</span>
            <span>✓ Pasture raised</span>
            <span>✓ Non-GMO feed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
