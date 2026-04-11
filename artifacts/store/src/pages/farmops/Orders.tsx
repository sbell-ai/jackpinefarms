import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ShoppingBasket,
  ArrowLeft,
  Loader2,
  ChevronRight,
  Package,
  PhoneCall,
} from "lucide-react";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";
import FarmOpsOrderDetail from "./OrderDetail";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending Payment",
  deposit_paid: "Deposit Paid",
  cash_pending: "Cash Pending",
  pickup_assigned: "Pickup Assigned",
  weights_entered: "Weights Entered",
  invoice_sent: "Invoice Sent",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  no_show: "No Show",
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  deposit_paid: "bg-green-100 text-green-800",
  cash_pending: "bg-blue-100 text-blue-800",
  pickup_assigned: "bg-purple-100 text-purple-800",
  weights_entered: "bg-indigo-100 text-indigo-800",
  invoice_sent: "bg-indigo-100 text-indigo-800",
  fulfilled: "bg-teal-100 text-teal-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-red-100 text-red-800",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: number;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentMethod: string;
  source: string;
  totalInCents: number;
  createdAt: string;
}

interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  pricingType: string;
  unitPriceInCents: number;
  unitLabel: string | null;
  variantLabel: string | null;
  lineTotalInCents: number;
  isGiblets: boolean;
}

interface OrderDetail {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  paymentMethod: string;
  source: string;
  totalInCents: number;
  notes: string | null;
  finalWeightLbs: number | null;
  appliedCouponCode: string | null;
  createdAt: string;
  items: OrderItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Order Detail View ────────────────────────────────────────────────────────

function OrderDetailView({
  orderId,
  onBack,
}: {
  orderId: number;
  onBack: () => void;
}) {
  const { data: order, isLoading, isError } = useQuery<OrderDetail>({
    queryKey: ["farmops-order-detail", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/farmops/orders/${orderId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load order");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </button>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 text-sm">
          Failed to load order details. Please try again.
        </div>
      </div>
    );
  }

  const itemsTotal = order.items.reduce((s, i) => s + i.lineTotalInCents, 0);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </button>

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm text-slate-500">
                #{String(order.id).padStart(4, "0")}
              </span>
              <StatusBadge status={order.status} />
              {order.source === "admin" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  <PhoneCall className="w-3 h-3" /> Admin order
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{order.customerName}</h1>
            {order.customerEmail && (
              <p className="text-sm text-slate-500 mt-0.5">{order.customerEmail}</p>
            )}
            {order.customerPhone && (
              <p className="text-sm text-slate-500">{order.customerPhone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">
              {formatMoney(order.totalInCents)}
            </p>
            <p className="text-sm text-slate-500 mt-0.5 capitalize">
              {order.paymentMethod}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>

        {(order.notes || order.appliedCouponCode || order.finalWeightLbs != null) && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-sm text-slate-600">
            {order.finalWeightLbs != null && (
              <span>
                <span className="font-medium text-slate-700">Final weight:</span>{" "}
                {order.finalWeightLbs} lbs
              </span>
            )}
            {order.appliedCouponCode && (
              <span>
                <span className="font-medium text-slate-700">Coupon:</span>{" "}
                {order.appliedCouponCode}
              </span>
            )}
            {order.notes && (
              <span className="italic text-slate-500">{order.notes}</span>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            Order Items
          </h2>
        </div>

        {order.items.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">
            No items on this order.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600">Product</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Unit Price</th>
                    <th className="text-right px-6 py-3 font-semibold text-slate-600">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-medium text-slate-900">{item.productName}</span>
                        {item.variantLabel && (
                          <span className="text-slate-500 ml-1.5">· {item.variantLabel}</span>
                        )}
                        {item.isGiblets && (
                          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                            Giblets
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {item.quantity}
                        {item.unitLabel && (
                          <span className="text-slate-400 ml-1 text-xs">{item.unitLabel}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatMoney(item.unitPriceInCents)}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-900">
                        {formatMoney(item.lineTotalInCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <div className="space-y-1 min-w-[200px]">
                {itemsTotal !== order.totalInCents && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatMoney(itemsTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatMoney(order.totalInCents)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Orders List View ─────────────────────────────────────────────────────────

function OrdersListView({ onSelect }: { onSelect: (id: number) => void }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const inputCls =
    "px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

  const { data: orders = [], isLoading, isError } = useQuery<Order[]>({
    queryKey: ["farmops-orders", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/farmops/orders?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) ||
      String(o.id).padStart(4, "0").includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            Customer orders placed through your storefront
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputCls}
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Name, email, or order #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} w-56`}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-red-500 text-sm font-medium">
              Failed to load orders. Please try again.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBasket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {orders.length === 0 ? "No orders yet." : "No orders match your filters."}
            </p>
            {orders.length === 0 && (
              <p className="text-sm text-slate-400 mt-1">
                Orders will appear here once customers place them.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Mobile list */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {filtered.map((order) => (
                <button
                  key={order.id}
                  onClick={() => onSelect(order.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-slate-400">
                        #{String(order.id).padStart(4, "0")}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {order.customerName}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(new Date(order.createdAt), "MMM d, yyyy")}
                      {" · "}
                      <span className="capitalize">{order.paymentMethod}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-900 text-sm">
                      {formatMoney(order.totalInCents)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Order</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Payment</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => onSelect(order.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs text-slate-500">
                          #{String(order.id).padStart(4, "0")}
                        </div>
                        {order.source === "admin" && (
                          <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            <PhoneCall className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{order.customerName}</div>
                        <div className="text-xs text-slate-400">{order.customerEmail || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {format(new Date(order.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-slate-500 capitalize">
                        {order.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatMoney(order.totalInCents)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
              {filtered.length} order{filtered.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page Root ────────────────────────────────────────────────────────────────

export default function FarmOpsOrders() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) {
      setLocation("/farmops/login");
    }
  }, [session, sessionLoading, setLocation]);

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {selectedOrderId !== null ? (
        <FarmOpsOrderDetail
          orderId={selectedOrderId}
          onBack={() => setSelectedOrderId(null)}
          session={session}
        />
      ) : (
        <OrdersListView onSelect={setSelectedOrderId} />
      )}
    </div>
  );
}
