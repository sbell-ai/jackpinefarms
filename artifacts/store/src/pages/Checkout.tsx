import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetCart, getGetCartQueryKey, 
  useAuthMe, getAuthMeQueryKey,
  useCreateStripeCheckout,
  useCreateCashOrder
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatMoney } from "@/lib/utils";
import { Loader2, CreditCard, Banknote, AlertTriangle, Lock as LockIcon, Tag, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const checkoutSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Phone is required for pickup coordination"),
  notes: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

interface AppliedCoupon {
  code: string;
  discountAmountCents: number;
  description: string;
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: cart, isLoading: isCartLoading } = useGetCart({
    query: { queryKey: getGetCartQueryKey() }
  });
  
  const { data: session } = useAuthMe({
    query: { queryKey: getAuthMeQueryKey(), retry: false }
  });

  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cash'>('cash');
  const [gibletsUpdating, setGibletsUpdating] = useState<number | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const hasDeposits = (cart?.items as any[] | undefined)?.some(
    (item: any) => item.pricingType === "deposit"
  ) ?? false;

  useEffect(() => {
    if (hasDeposits) setPaymentMethod('stripe');
  }, [hasDeposits]);

  const handleToggleGiblets = async (productId: number, quantity: number, currentGiblets: boolean) => {
    setGibletsUpdating(productId);
    try {
      await fetch(`/api/cart/items/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity, addGiblets: !currentGiblets }),
      });
      await queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
    } finally {
      setGibletsUpdating(null);
    }
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    setCouponError(null);
    setIsValidatingCoupon(true);
    try {
      const res = await fetch("/api/cart/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, cartTotal: cart?.subtotalInCents ?? 0 }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCouponError(data.error ?? "Invalid or expired coupon code");
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({
        code: data.code,
        discountAmountCents: data.discountAmountCents,
        description: data.description ?? `${data.discountType === "percent" ? `${data.discountValue}% off` : formatMoney(data.discountValue)} your order`,
      });
      setCouponInput("");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const stripeMutation = useCreateStripeCheckout();
  const cashMutation = useCreateCashOrder();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema)
  });

  useEffect(() => {
    if (session?.id && session.email) {
      reset({
        name: session.name || "",
        email: session.email || "",
        phone: session.phone || "",
      });
    }
  }, [session, reset]);

  useEffect(() => {
    if (!isCartLoading && (!cart || cart.items.length === 0)) {
      setLocation("/cart");
    }
  }, [cart, isCartLoading, setLocation]);

  const onSubmit = async (data: CheckoutForm) => {
    try {
      const payload = { ...data, couponCode: appliedCoupon?.code };
      if (paymentMethod === 'stripe') {
        const res = await stripeMutation.mutateAsync({ data: payload });
        window.location.href = res.checkoutUrl;
      } else {
        const res = await cashMutation.mutateAsync({ data: payload });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        setLocation(`/order-confirmation?id=${res.id}`);
      }
    } catch (error: any) {
      toast({
        title: "Checkout failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  if (isCartLoading || !cart) {
    return <div className="flex-1 flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  const isPending = stripeMutation.isPending || cashMutation.isPending;
  const subtotal = cart.subtotalInCents;
  const discount = appliedCoupon?.discountAmountCents ?? 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="flex-1 bg-muted/30">
      <div className="h-48 md:h-64 w-full relative overflow-hidden bg-primary">
        <img 
          src={`${import.meta.env.BASE_URL}images/checkout-hero.png`} 
          alt="Farm Checkout" 
          className="w-full h-full object-cover opacity-60 mix-blend-overlay"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white shadow-sm">Checkout</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Form Area */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {hasDeposits && (
              <div className="bg-accent/10 border-2 border-accent/20 rounded-2xl p-6 flex gap-4 items-start shadow-sm">
                <AlertTriangle className="w-6 h-6 text-accent shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-accent mb-1">Non-Refundable Preorder Deposits</h3>
                  <p className="text-foreground/80 leading-relaxed">
                    Your cart contains preorder deposits for meat products. These deposits secure your order and are <strong>non-refundable</strong>. The final price will be calculated by exact weight, and you will receive an invoice for the balance the day before pickup.
                  </p>
                </div>
              </div>
            )}

            <form id="checkout-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Contact Info */}
              <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
                <h2 className="text-2xl font-serif font-bold text-foreground mb-6 pb-4 border-b border-border">Contact Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Full Name</label>
                    <input {...register("name")} className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    {errors.name && <p className="text-destructive text-xs font-medium">{errors.name.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Email Address</label>
                    <input type="email" {...register("email")} className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    {errors.email && <p className="text-destructive text-xs font-medium">{errors.email.message}</p>}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-foreground">Phone Number</label>
                    <input type="tel" {...register("phone")} placeholder="(555) 123-4567" className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    <p className="text-xs text-muted-foreground">Required to coordinate local pickup</p>
                    {errors.phone && <p className="text-destructive text-xs font-medium">{errors.phone.message}</p>}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-foreground">Order Notes (Optional)</label>
                    <textarea {...register("notes")} rows={3} placeholder="Any special instructions for pickup..." className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y" />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
                <h2 className="text-2xl font-serif font-bold text-foreground mb-6 pb-4 border-b border-border">Payment Method</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`
                    relative flex flex-col p-5 rounded-2xl cursor-pointer border-2 transition-all
                    ${paymentMethod === 'stripe' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/30'}
                  `}>
                    <input 
                      type="radio" 
                      name="payment" 
                      value="stripe" 
                      checked={paymentMethod === 'stripe'}
                      onChange={() => setPaymentMethod('stripe')}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-foreground flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary" />
                        Credit Card
                      </span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'stripe' ? 'border-primary' : 'border-muted-foreground'}`}>
                        {paymentMethod === 'stripe' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Pay securely via Stripe</p>
                  </label>

                  <label className={`
                    relative flex flex-col p-5 rounded-2xl border-2 transition-all
                    ${hasDeposits
                      ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                      : paymentMethod === 'cash'
                        ? 'border-primary bg-primary/5 cursor-pointer'
                        : 'border-border bg-background hover:border-primary/30 cursor-pointer'}
                  `}>
                    <input 
                      type="radio" 
                      name="payment" 
                      value="cash" 
                      checked={paymentMethod === 'cash'}
                      onChange={() => !hasDeposits && setPaymentMethod('cash')}
                      disabled={hasDeposits}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-center mb-2">
                      <span className={`font-bold flex items-center gap-2 ${hasDeposits ? 'text-muted-foreground' : 'text-foreground'}`}>
                        <Banknote className="w-5 h-5" />
                        Cash at Pickup
                      </span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cash' && !hasDeposits ? 'border-primary' : 'border-muted-foreground'}`}>
                        {paymentMethod === 'cash' && !hasDeposits && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                    </div>
                    {hasDeposits
                      ? <p className="text-xs text-amber-600 dark:text-amber-400">Preorder deposits require card payment</p>
                      : <p className="text-sm text-muted-foreground">Pay when you collect your order</p>
                    }
                  </label>
                </div>
              </div>
            </form>
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-card border border-border rounded-3xl p-6 shadow-md sticky top-28 space-y-5">
              <h3 className="font-serif text-xl font-bold text-foreground">Order Summary</h3>
              
              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                {(cart.items as any[]).map(item => (
                  <div key={item.productId} className="text-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="pr-4">
                        <span className="font-bold text-foreground block">{item.quantity}x {item.productName}</span>
                        {item.pricingType === "deposit" && (
                          <span className="text-xs text-accent">Deposit</span>
                        )}
                      </div>
                      <span className="font-bold">{formatMoney(item.lineTotalInCents)}</span>
                    </div>
                    {item.pricingType === "deposit" && (
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                          checked={!!item.addGiblets}
                          disabled={gibletsUpdating === item.productId}
                          onChange={() => handleToggleGiblets(item.productId, item.quantity, !!item.addGiblets)}
                        />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                          Add Giblets (+$2.00) <span className="text-green-600 dark:text-green-400">refundable</span>
                        </span>
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {/* Coupon Code Input */}
              <div className="border-t border-border pt-4 space-y-2">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Check className="w-4 h-4 shrink-0" />
                      <div>
                        <p className="text-xs font-bold font-mono">{appliedCoupon.code}</p>
                        <p className="text-xs">{appliedCoupon.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-800 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Coupon Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                        onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleApplyCoupon())}
                        placeholder="Enter code"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-mono uppercase placeholder:normal-case placeholder:font-sans"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={!couponInput.trim() || isValidatingCoupon}
                        className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-bold transition-colors disabled:opacity-40 shrink-0"
                      >
                        {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-destructive text-xs font-medium">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-semibold">
                    <span>Discount ({appliedCoupon?.code})</span>
                    <span>−{formatMoney(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1 border-t border-border">
                  <span className="font-bold text-lg">Total Due Now</span>
                  <span className="font-bold text-2xl text-primary">{formatMoney(total)}</span>
                </div>
              </div>

              <button 
                type="submit" 
                form="checkout-form"
                disabled={isPending}
                className="w-full py-4 rounded-xl bg-primary text-white font-bold text-lg hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  paymentMethod === 'stripe' ? "Pay with Card" : "Place Order"
                )}
              </button>
              
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                <LockIcon className="w-3 h-3" /> Secure checkout
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
