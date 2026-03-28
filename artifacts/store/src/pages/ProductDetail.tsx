import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { 
  useGetProduct, getGetProductQueryKey,
  useSubscribeNotifyMe,
  useAddCartItem,
  getGetCartQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@/lib/utils";
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle, ShoppingBag, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProductDetail() {
  const [, params] = useRoute("/shop/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: product, isLoading, isError } = useGetProduct(id, {
    query: { queryKey: getGetProductQueryKey(id) }
  });
  
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySuccess, setNotifySuccess] = useState(false);
  
  // Cart state — egg step sizes enforced client-side to match server rules
  const eggStep =
    product?.productType === "eggs_chicken" ? 12
    : product?.productType === "eggs_duck" ? 6
    : 1;
  const [quantity, setQuantity] = useState(1);
  const [addGiblets, setAddGiblets] = useState(false);

  const isEgg = eggStep > 1;

  // Reset quantity to minimum step when product type is known
  useEffect(() => {
    if (product) {
      const step = product.productType === "eggs_chicken" ? 12
        : product.productType === "eggs_duck" ? 6
        : 1;
      setQuantity(step);
    }
  }, [product?.productType]);
  
  const notifyMutation = useSubscribeNotifyMe();
  const addToCartMutation = useAddCartItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({
          title: "Added to cart",
          description: `${product?.name} has been added to your cart.`,
        });
        setLocation("/cart");
      }
    }
  });

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail) return;
    try {
      await notifyMutation.mutateAsync({ id, data: { email: notifyEmail } });
      setNotifySuccess(true);
      setNotifyEmail("");
    } catch (err) {}
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCartMutation.mutate({
      data: {
        productId: product.id,
        quantity: product.pricingType === 'deposit' ? 1 : quantity, // Meat is 1 deposit per item added
        addGiblets: addGiblets
      }
    });
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

  const isMeat = product.productType.startsWith('meat_');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 w-full">
      <Link href="/shop" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Shop
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
        {/* Images */}
        <div className="rounded-3xl overflow-hidden bg-card border border-border shadow-md">
          <div className="aspect-[4/3] w-full relative">
            {(product.images?.[0]?.url ?? product.imageUrl) ? (
              <img src={product.images?.[0]?.url ?? product.imageUrl!} alt={product.name} className="w-full h-full object-cover" />
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

          <div
            className="prose prose-sm max-w-none prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground prose-strong:text-foreground mb-8"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />

          {/* Deposit Info Box */}
          {product.pricingType === 'deposit' && (
            <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 mb-8">
              <h4 className="font-bold text-accent mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Preorder Deposit — How It Works
              </h4>
              <p className="text-sm font-semibold text-destructive mb-3">
                ⚠ This deposit is non-refundable.
              </p>
              <ol className="text-sm text-foreground/80 space-y-2 list-none mb-4">
                <li className="flex gap-2"><span className="font-bold text-accent shrink-0">1.</span> Pay the deposit now to reserve your spot in the next processing batch.</li>
                <li className="flex gap-2"><span className="font-bold text-accent shrink-0">2.</span> We raise and process your order. Final price is calculated by actual weight.</li>
                <li className="flex gap-2"><span className="font-bold text-accent shrink-0">3.</span> You receive an invoice for the remaining balance before your scheduled pickup date.</li>
                <li className="flex gap-2"><span className="font-bold text-accent shrink-0">4.</span> Pay the balance and pick up locally — no shipping.</li>
              </ol>
              {product.depositDescription && (
                <p className="text-sm text-foreground/80 bg-white/50 p-3 rounded-lg border border-accent/10">
                  {product.depositDescription}
                </p>
              )}
            </div>
          )}

          {/* Options & Call to Action Area */}
          <div className="mt-auto border-t border-border pt-8">
            {(product.availability === 'taking_orders' || product.availability === 'preorder') && (
              <div className="space-y-6">
                
                {/* Quantity for non-deposit items */}
                {product.pricingType === 'unit' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-foreground">Quantity:</span>
                      <div className="flex items-center bg-background border border-border rounded-xl p-1">
                        <button 
                          onClick={() => setQuantity(Math.max(eggStep, quantity - eggStep))}
                          disabled={quantity <= eggStep}
                          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted text-foreground transition-colors disabled:opacity-40"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                        <button 
                          onClick={() => setQuantity(quantity + eggStep)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted text-foreground transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {isEgg && (
                      <p className="text-sm text-muted-foreground">
                        {eggStep === 12
                          ? "Sold by the dozen (12 eggs). Minimum 1 dozen."
                          : "Sold by the half-dozen (6 eggs). Minimum 6 eggs."}
                      </p>
                    )}
                  </div>
                )}

                {/* Giblets Add-on for meat */}
                {isMeat && (
                  <label className="flex items-start gap-3 p-4 border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="mt-1 w-5 h-5 rounded border-border text-primary focus:ring-primary"
                      checked={addGiblets}
                      onChange={(e) => setAddGiblets(e.target.checked)}
                    />
                    <div>
                      <div className="font-bold text-foreground">Add Giblets (+$2.00)</div>
                      <p className="text-sm text-muted-foreground">Includes heart, liver, and neck. Highly recommended for rich gravy and stock. <span className="text-green-600 dark:text-green-400 font-medium">Refundable if your order is cancelled.</span></p>
                    </div>
                  </label>
                )}

                <button 
                  onClick={handleAddToCart}
                  disabled={addToCartMutation.isPending}
                  className="w-full py-4 rounded-xl bg-primary text-white font-bold text-lg hover:bg-primary/90 hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {addToCartMutation.isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                      {product.pricingType === 'deposit' ? "Place Deposit" : "Add to Cart"}
                    </>
                  )}
                </button>
              </div>
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
              </div>
            )}
          </div>
          
          <div className="mt-8 flex flex-wrap gap-4 text-sm font-medium text-muted-foreground border-t border-border pt-6">
            <span className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4 text-primary" /> Local pickup only</span>
            <span className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4 text-primary" /> Pasture raised</span>
            <span className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4 text-primary" /> Non-GMO feed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
