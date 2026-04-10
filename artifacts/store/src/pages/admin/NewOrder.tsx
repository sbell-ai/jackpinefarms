import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import {
  useAdminCreateOrder,
  useAdminSetOrderItems,
  useAdminFinalizeOrder,
  useAdminListCustomers,
  useAdminCreateCustomer,
  getAdminListCustomersQueryKey,
  useListProducts,
  PricingType,
  type AdminCustomerSummary,
  type OrderDetail,
  type Product,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, PhoneCall, ShoppingCart, CreditCard, Check,
  Plus, Minus, Trash2, Search, UserPlus, Copy, CheckCheck, ExternalLink,
} from "lucide-react";

type Step = "customer" | "items" | "payment";

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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

export default function AdminNewOrder() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("customer");
  const [orderId, setOrderId] = useState<number | null>(null);

  // --- Step 1: customer search ---
  const [customerMode, setCustomerMode] = useState<"search" | "new">("search");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerSummary | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const searchParams = { search: debouncedSearch, limit: 8 };
  const { data: searchResults = [], isFetching: isSearching } = useAdminListCustomers(
    searchParams,
    {
      query: {
        queryKey: getAdminListCustomersQueryKey(searchParams),
        enabled: customerMode === "search" && debouncedSearch.length >= 2,
      },
    },
  );

  // --- Step 2: items ---
  const [localCart, setLocalCart] = useState<{ productId: number; quantity: number }[]>([]);
  const [serverOrder, setServerOrder] = useState<OrderDetail | null>(null);

  const { data: allProducts = [] } = useListProducts({ includeDisabled: false });

  // --- Step 3: finalize ---
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [finalOrderId, setFinalOrderId] = useState<number | null>(null);

  const createOrder = useAdminCreateOrder({
    mutation: {
      onSuccess: (order) => {
        setOrderId(order.id);
        setStep("items");
      },
      onError: (e: { response?: { data?: { error?: string } }; message?: string }) => {
        toast({ title: "Error", description: e.response?.data?.error ?? e.message ?? "Unknown error", variant: "destructive" });
      },
    },
  });

  const createCustomer = useAdminCreateCustomer({
    mutation: {
      onSuccess: (customer: AdminCustomerSummary) => {
        createOrder.mutate({
          data: {
            customerId: customer.id,
            customerName: customer.name,
            customerEmail: customer.email ?? undefined,
            customerPhone: customer.phone ?? undefined,
          },
        });
      },
      onError: (e: { response?: { data?: { error?: string } }; message?: string }) => {
        toast({ title: "Error", description: e.response?.data?.error ?? e.message ?? "Unknown error", variant: "destructive" });
      },
    },
  });

  const syncItems = useAdminSetOrderItems({
    mutation: {
      onSuccess: (order) => {
        setServerOrder(order);
      },
      onError: (e: { response?: { data?: { error?: string } }; message?: string }) => {
        toast({ title: "Error", description: e.response?.data?.error ?? e.message ?? "Unknown error", variant: "destructive" });
      },
    },
  });

  const finalizeOrder = useAdminFinalizeOrder({
    mutation: {
      onSuccess: (data) => {
        if (data.checkoutUrl) {
          setCheckoutUrl(data.checkoutUrl);
          setFinalOrderId(data.order.id);
        } else {
          toast({ title: "Order created — cash pending" });
          navigate(`/admin/orders/${data.order.id}`);
        }
      },
      onError: (e: { response?: { data?: { error?: string } }; message?: string }) => {
        toast({ title: "Error", description: e.response?.data?.error ?? e.message ?? "Unknown error", variant: "destructive" });
      },
    },
  });

  function syncToServer(cart: { productId: number; quantity: number }[]) {
    if (orderId == null) return;
    syncItems.mutate({ id: orderId, data: cart });
  }

  function addItem(product: Product) {
    const existing = localCart.find((c) => c.productId === product.id);
    const newCart = existing
      ? localCart.map((c) => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c)
      : [...localCart, { productId: product.id, quantity: 1 }];
    setLocalCart(newCart);
    syncToServer(newCart);
  }

  function changeQty(productId: number, delta: number) {
    const newCart = localCart
      .map((c) => c.productId === productId ? { ...c, quantity: c.quantity + delta } : c)
      .filter((c) => c.quantity > 0);
    setLocalCart(newCart);
    syncToServer(newCart);
  }

  const handleCustomerNext = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomer) {
      if (!selectedCustomer.phone || selectedCustomer.phone.length < 10) {
        setCustomerErrors({ phone: "This customer has no phone number on file. Please update their profile before creating an order." });
        return;
      }
      setCustomerErrors({});
      createOrder.mutate({
        data: {
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          customerEmail: selectedCustomer.email ?? undefined,
          customerPhone: selectedCustomer.phone,
        },
      });
      return;
    }
    const errs: Record<string, string> = {};
    if (!newCustomer.name.trim()) errs.name = "Name is required";
    if (newCustomer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email)) {
      errs.email = "Invalid email address";
    }
    if (!newCustomer.phone.trim() || newCustomer.phone.trim().length < 10) {
      errs.phone = "Phone number is required (min 10 digits)";
    }
    if (Object.keys(errs).length > 0) { setCustomerErrors(errs); return; }
    setCustomerErrors({});
    createCustomer.mutate({
      data: {
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim() || undefined,
        phone: newCustomer.phone.trim(),
        notes: newCustomer.notes.trim() || undefined,
      },
    });
  }, [selectedCustomer, newCustomer, createOrder, createCustomer]);

  const displayItems = serverOrder?.items ?? [];
  const displayTotal = serverOrder?.totalInCents ?? 0;
  const unusedProducts = allProducts.filter((p) => !localCart.find((c) => c.productId === p.id));

  const steps: { key: Step; label: string; index: number }[] = [
    { key: "customer", label: "Customer", index: 1 },
    { key: "items", label: "Add Items", index: 2 },
    { key: "payment", label: "Payment", index: 3 },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  const customerName = selectedCustomer?.name ?? newCustomer.name;
  const customerEmail = selectedCustomer?.email ?? newCustomer.email;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Admin Order</h1>
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
            done={stepIndex > s.index - 1 && step !== s.key}
          />
        ))}
      </div>

      {/* Step 1: Customer */}
      {step === "customer" && (
        <form onSubmit={handleCustomerNext} className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <PhoneCall className="w-4 h-4 text-amber-600" />
              Customer
            </div>

            {/* Search or New toggle */}
            {!selectedCustomer && (
              <div className="flex gap-2 border-b border-border pb-4 mb-2">
                <button
                  type="button"
                  onClick={() => setCustomerMode("search")}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${customerMode === "search" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Search className="w-3.5 h-3.5" /> Find existing
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode("new")}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${customerMode === "new" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <UserPlus className="w-3.5 h-3.5" /> New customer
                </button>
              </div>
            )}

            {/* Selected customer card */}
            {selectedCustomer && (
              <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{selectedCustomer.name}</div>
                  {selectedCustomer.email && <div className="text-xs text-muted-foreground">{selectedCustomer.email}</div>}
                  {selectedCustomer.phone && <div className="text-xs text-muted-foreground">{selectedCustomer.phone}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedCustomer(null); setCustomerMode("search"); setSearchInput(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Change
                </button>
              </div>
              {customerErrors.phone && <p className="text-xs text-red-500">{customerErrors.phone}</p>}
              </div>
            )}

            {/* Search mode */}
            {!selectedCustomer && customerMode === "search" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  )}
                </div>
                {debouncedSearch.length >= 2 && searchResults.length > 0 && (
                  <div className="border border-border rounded-md bg-card divide-y divide-border shadow-sm max-h-52 overflow-y-auto">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedCustomer(c); setSearchInput(""); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="text-sm font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[c.email, c.phone].filter(Boolean).join(" · ")}
                          {c.orderCount > 0 && <span className="ml-2 text-primary">{c.orderCount} order{c.orderCount !== 1 ? "s" : ""}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {debouncedSearch.length >= 2 && !isSearching && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground px-1">
                    No customers found.{" "}
                    <button type="button" onClick={() => setCustomerMode("new")} className="text-primary underline">Create new</button>
                  </p>
                )}
                {debouncedSearch.length < 2 && searchInput.length > 0 && (
                  <p className="text-xs text-muted-foreground px-1">Type at least 2 characters to search</p>
                )}
              </div>
            )}

            {/* New customer form */}
            {!selectedCustomer && customerMode === "new" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Full name"
                  />
                  {customerErrors.name && <p className="text-xs text-red-500 mt-1">{customerErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email <span className="text-xs text-muted-foreground">(optional)</span></label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="email@example.com"
                  />
                  {customerErrors.email && <p className="text-xs text-red-500 mt-1">{customerErrors.email}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Required to send a Stripe payment link.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="555-555-5555"
                    required
                  />
                  {customerErrors.phone && <p className="text-xs text-red-500 mt-1">{customerErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Order Notes <span className="text-xs text-muted-foreground">(optional)</span></label>
                  <textarea
                    value={newCustomer.notes}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={2}
                    placeholder="Special instructions..."
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createOrder.isPending || createCustomer.isPending || (!selectedCustomer && customerMode === "search" && !newCustomer.name)}>
              {createCustomer.isPending ? "Creating customer..." : createOrder.isPending ? "Creating order..." : "Next: Add Items"}
            </Button>
          </div>
        </form>
      )}

      {/* Step 2: Items */}
      {step === "items" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Add Products
              {syncItems.isPending && (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <div className="w-3 h-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Syncing...
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <select
                defaultValue=""
                onChange={(e) => {
                  const p = allProducts.find((x) => x.id === Number(e.target.value));
                  if (p) { addItem(p); e.currentTarget.value = ""; }
                }}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="" disabled>Select a product to add...</option>
                {unusedProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${(p.priceInCents / 100).toFixed(2)}
                    {p.pricingType === PricingType.deposit ? " (deposit)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {localCart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No items added yet. Select a product above.
              </div>
            ) : (
              <div className={`divide-y divide-border transition-opacity ${syncItems.isPending ? "opacity-60 pointer-events-none" : ""}`}>
                {displayItems.length > 0
                  ? displayItems.map((item) => {
                      const local = localCart.find((c) => c.productId === (item.productId ?? 0));
                      return (
                        <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              ${(item.unitPriceInCents / 100).toFixed(2)} each
                              {item.pricingType === PricingType.deposit ? " (deposit)" : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => changeQty(item.productId ?? 0, -1)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {(local?.quantity ?? 1) === 1 ? <Trash2 className="w-4 h-4 text-red-400" /> : <Minus className="w-4 h-4" />}
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{local?.quantity ?? item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => changeQty(item.productId ?? 0, 1)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-sm font-medium text-foreground w-20 text-right">
                            ${(item.lineTotalInCents / 100).toFixed(2)}
                          </div>
                        </div>
                      );
                    })
                  : localCart.map((c) => {
                      const p = allProducts.find((x) => x.id === c.productId);
                      return (
                        <div key={c.productId} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">{p?.name ?? "Product"}</div>
                            <div className="text-xs text-muted-foreground">Pricing from server...</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => changeQty(c.productId, -1)} className="p-1 rounded hover:bg-muted transition-colors">
                              {c.quantity === 1 ? <Trash2 className="w-4 h-4 text-red-400" /> : <Minus className="w-4 h-4" />}
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{c.quantity}</span>
                            <button type="button" onClick={() => changeQty(c.productId, 1)} className="p-1 rounded hover:bg-muted transition-colors">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-sm text-muted-foreground w-20 text-right">—</div>
                        </div>
                      );
                    })}
                {displayItems.length > 0 && (
                  <div className="pt-3 flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">Total</span>
                    <span className="text-base font-bold text-foreground">${(displayTotal / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("customer")}>
              Back
            </Button>
            <Button
              type="button"
              disabled={localCart.length === 0 || syncItems.isPending}
              onClick={() => setStep("payment")}
            >
              Next: Payment Method
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Payment */}
      {step === "payment" && (
        <div className="space-y-4">
          {checkoutUrl ? (
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <Check className="w-4 h-4" /> Order created — Stripe payment link ready
              </div>
              <p className="text-sm text-muted-foreground">
                Share this payment link with <span className="font-medium text-foreground">{customerName}</span> to collect their deposit.
              </p>
              <div className="rounded-md bg-muted/40 border border-border p-3 break-all text-xs font-mono text-foreground">
                {checkoutUrl}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <CopyButton text={checkoutUrl} />
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open link
                </a>
                <Link href={`/admin/orders/${finalOrderId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto">
                  View order detail
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Payment Method
              </div>

              <p className="text-sm text-muted-foreground">
                How will <span className="font-medium text-foreground">{customerName || "the customer"}</span> pay?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  disabled={finalizeOrder.isPending}
                  onClick={() => finalizeOrder.mutate({ id: orderId!, data: { paymentMethod: "cash" } })}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <span className="text-2xl font-bold text-green-700">$</span>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Cash at Pickup</div>
                    <div className="text-xs text-muted-foreground mt-1">Sets status to Cash Pending</div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={finalizeOrder.isPending || !customerEmail}
                  onClick={() => finalizeOrder.mutate({ id: orderId!, data: { paymentMethod: "stripe" } })}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <CreditCard className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Stripe Payment Link</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {customerEmail ? "Generates a secure checkout link" : "Requires customer email"}
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
          )}

          {!checkoutUrl && (
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep("items")}>
                Back
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
