import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  useAdminCreateOrder,
  useAdminSetOrderItems,
  useAdminFinalizeOrder,
  useListProducts,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PhoneCall, ShoppingCart, CreditCard, Check, Plus, Minus, Trash2 } from "lucide-react";

type Step = "customer" | "items" | "payment";

interface CartItem {
  productId: number;
  productName: string;
  unitPriceInCents: number;
  pricingType: string;
  quantity: number;
}

function StepBadge({ step, label, current, done }: { step: number; label: string; current: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${done ? "text-green-600" : current ? "text-primary" : "text-muted-foreground"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${done ? "bg-green-100 border-green-500 text-green-700" : current ? "bg-primary/10 border-primary text-primary" : "border-border"}`}>
        {done ? <Check className="w-4 h-4" /> : step}
      </div>
      {label}
    </div>
  );
}

export default function AdminNewOrder() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("customer");
  const [orderId, setOrderId] = useState<number | null>(null);

  const [customer, setCustomer] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    notes: "",
  });
  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>({});

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const { data: allProducts = [] } = useListProducts({ includeDisabled: false } as any);
  const products = Array.isArray(allProducts) ? allProducts : [];

  const createOrder = useAdminCreateOrder({
    mutation: {
      onSuccess: (order: any) => {
        setOrderId(order.id);
        setStep("items");
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e.response?.data?.error ?? e.message, variant: "destructive" });
      },
    },
  });

  const setOrderItems = useAdminSetOrderItems({
    mutation: {
      onSuccess: () => {
        setStep("payment");
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e.response?.data?.error ?? e.message, variant: "destructive" });
      },
    },
  });

  const finalizeOrder = useAdminFinalizeOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order created" });
        navigate(`/admin/orders/${orderId}`);
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e.response?.data?.error ?? e.message, variant: "destructive" });
      },
    },
  });

  function validateCustomer() {
    const errs: Record<string, string> = {};
    if (!customer.customerName.trim()) errs.customerName = "Name is required";
    if (customer.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.customerEmail)) {
      errs.customerEmail = "Invalid email address";
    }
    return errs;
  }

  function handleCustomerNext(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateCustomer();
    if (Object.keys(errs).length > 0) { setCustomerErrors(errs); return; }
    setCustomerErrors({});
    createOrder.mutate({
      data: {
        customerName: customer.customerName.trim(),
        customerEmail: customer.customerEmail.trim() || undefined,
        customerPhone: customer.customerPhone.trim() || undefined,
        notes: customer.notes.trim() || undefined,
      },
    });
  }

  function addProductToCart() {
    if (!selectedProductId) return;
    const productId = Number(selectedProductId);
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    const existing = cart.find((c) => c.productId === productId);
    if (existing) {
      setCart((prev) => prev.map((c) => c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitPriceInCents: (product as any).priceInCents ?? (product as any).depositInCents ?? 0,
          pricingType: (product as any).pricingType ?? "fixed",
          quantity: 1,
        },
      ]);
    }
    setSelectedProductId("");
  }

  function updateQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => c.productId === productId ? { ...c, quantity: c.quantity + delta } : c)
        .filter((c) => c.quantity > 0)
    );
  }

  function handleItemsNext(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" });
      return;
    }
    setOrderItems.mutate({
      id: orderId!,
      data: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
    });
  }

  function handleFinalize(paymentMethod: "cash" | "stripe") {
    finalizeOrder.mutate({
      id: orderId!,
      data: { paymentMethod },
    });
  }

  const cartTotal = cart.reduce((s, c) => s + c.unitPriceInCents * c.quantity, 0);
  const unusedProducts = products.filter((p: any) => !cart.find((c) => c.productId === p.id));

  const steps: { key: Step; label: string; index: number }[] = [
    { key: "customer", label: "Customer Info", index: 1 },
    { key: "items", label: "Add Items", index: 2 },
    { key: "payment", label: "Payment", index: 3 },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Phone/Walk-in Order</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create an order on behalf of a customer</p>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-border pb-4">
        {steps.map((s) => (
          <StepBadge
            key={s.key}
            step={s.index}
            label={s.label}
            current={step === s.key}
            done={steps.findIndex((x) => x.key === step) > s.index - 1 && step !== s.key}
          />
        ))}
      </div>

      {step === "customer" && (
        <form onSubmit={handleCustomerNext} className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <PhoneCall className="w-4 h-4 text-amber-600" />
              Customer Information
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={customer.customerName}
                onChange={(e) => setCustomer((c) => ({ ...c, customerName: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Full name"
              />
              {customerErrors.customerName && <p className="text-xs text-red-500 mt-1">{customerErrors.customerName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email <span className="text-xs text-muted-foreground">(optional)</span></label>
              <input
                type="email"
                value={customer.customerEmail}
                onChange={(e) => setCustomer((c) => ({ ...c, customerEmail: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="email@example.com"
              />
              {customerErrors.customerEmail && <p className="text-xs text-red-500 mt-1">{customerErrors.customerEmail}</p>}
              <p className="text-xs text-muted-foreground mt-1">Required if you want to send a Stripe payment link.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Phone <span className="text-xs text-muted-foreground">(optional)</span></label>
              <input
                type="tel"
                value={customer.customerPhone}
                onChange={(e) => setCustomer((c) => ({ ...c, customerPhone: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="555-555-5555"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Order Notes <span className="text-xs text-muted-foreground">(optional)</span></label>
              <textarea
                value={customer.notes}
                onChange={(e) => setCustomer((c) => ({ ...c, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
                placeholder="Special instructions, preferences, etc."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? "Creating..." : "Next: Add Items"}
            </Button>
          </div>
        </form>
      )}

      {step === "items" && (
        <form onSubmit={handleItemsNext} className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Add Products
            </div>

            <div className="flex gap-2">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a product...</option>
                {unusedProducts.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${((p.priceInCents ?? p.depositInCents ?? 0) / 100).toFixed(2)}
                    {p.pricingType === "per_lb" ? "/lb (deposit)" : p.pricingType === "per_head" ? "/bird (deposit)" : ""}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={addProductToCart} disabled={!selectedProductId}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No items added yet. Select a product above.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cart.map((item) => (
                  <div key={item.productId} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        ${(item.unitPriceInCents / 100).toFixed(2)} each
                        {item.pricingType === "per_lb" ? " (deposit/lb)" : item.pricingType === "per_head" ? " (deposit/bird)" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, -1)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {item.quantity === 1 ? <Trash2 className="w-4 h-4 text-red-400" /> : <Minus className="w-4 h-4" />}
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, 1)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-sm font-medium text-foreground w-20 text-right">
                      ${((item.unitPriceInCents * item.quantity) / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="pt-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-base font-bold text-foreground">${(cartTotal / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("customer")}>
              Back
            </Button>
            <Button type="submit" disabled={setOrderItems.isPending || cart.length === 0}>
              {setOrderItems.isPending ? "Saving..." : "Next: Payment Method"}
            </Button>
          </div>
        </form>
      )}

      {step === "payment" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Payment Method
            </div>

            <p className="text-sm text-muted-foreground">
              How will <span className="font-medium text-foreground">{customer.customerName}</span> pay?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                disabled={finalizeOrder.isPending}
                onClick={() => handleFinalize("cash")}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <span className="text-2xl">$</span>
                </div>
                <div>
                  <div className="font-semibold text-foreground">Cash at Pickup</div>
                  <div className="text-xs text-muted-foreground mt-1">Order goes to Cash Pending status</div>
                </div>
              </button>

              <button
                type="button"
                disabled={finalizeOrder.isPending || !customer.customerEmail}
                onClick={() => handleFinalize("stripe")}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <CreditCard className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Stripe Payment Link</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {customer.customerEmail
                      ? "Generates a secure payment link"
                      : "Requires customer email"}
                  </div>
                </div>
              </button>
            </div>

            {finalizeOrder.isPending && (
              <div className="flex items-center justify-center py-2 text-sm text-muted-foreground gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                Finalizing order...
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("items")}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
