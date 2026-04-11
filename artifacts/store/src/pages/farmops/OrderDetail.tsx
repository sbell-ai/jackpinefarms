import { useState } from "react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Package,
  MessageSquare,
  RefreshCw,
  FileText,
  DollarSign,
  Pencil,
  Trash2,
  Plus,
  Minus,
  X,
  PhoneCall,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { FarmopsSession } from "@/hooks/useFarmopsAuth";

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

const EVENT_ICONS: Record<string, string> = {
  status_change: "🔄",
  refund: "💸",
  note: "📝",
  invoice_sent: "📧",
  pickup_assigned: "📅",
  weights_entered: "⚖️",
};

const inputCls =
  "px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none " +
  "focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  pricingType: string;
  unitPriceInCents: number;
  unitLabel: string | null;
  variantLabel: string | null;
  isGiblets: boolean;
  lineTotalInCents: number;
}

interface OrderEvent {
  id: number;
  eventType: string;
  body: string;
  createdAt: string;
}

interface OrderDetail {
  id: number;
  tenantId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  paymentMethod: string;
  source: string;
  totalInCents: number;
  notes: string | null;
  finalWeightLbs: number | null;
  batchId: number | null;
  pickupEventId: number | null;
  pickupEventName: string | null;
  pickupEventScheduledAt: string | null;
  refundedGiblets: boolean;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  appliedCouponCode: string | null;
  createdAt: string;
  items: OrderItem[];
  events: OrderEvent[];
}

interface Batch {
  id: number;
  name: string;
  status: string;
  pricePerLbCentsWhole: number;
  pricePerLbCentsHalf: number;
  pricePerLbCentsQuarter: number;
}

interface Product {
  id: number;
  name: string;
  priceInCents: number;
  pricingType: string;
  availability: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getErrMsg(e: unknown): string {
  const ae = e as { error?: string; message?: string };
  return ae?.error ?? ae?.message ?? "Unknown error";
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

function SectionCard({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          {icon}
          {title}
        </h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FarmOpsOrderDetail({
  orderId,
  onBack,
  session,
}: {
  orderId: number;
  onBack: () => void;
  session: FarmopsSession;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const QUERY_KEY = ["farmops-order-detail", orderId];

  const isReadOnly = session.user.role === "member";
  const isOwner = session.user.role === "owner";

  // ── Status update ──
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [statusPending, setStatusPending] = useState(false);

  // ── Edit customer ──
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhoneError, setEditPhoneError] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPending, setEditPending] = useState(false);

  // ── Edit items ──
  const [itemsEditOpen, setItemsEditOpen] = useState(false);
  type DraftItem = { productId: number; quantity: number; productName: string };
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [itemsPending, setItemsPending] = useState(false);

  // ── Notes ──
  const [newNote, setNewNote] = useState("");
  const [notePending, setNotePending] = useState(false);

  // ── Batch ──
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batchPending, setBatchPending] = useState(false);

  // ── Invoice ──
  const [invoiceWeight, setInvoiceWeight] = useState("");
  const [invoiceVariant, setInvoiceVariant] = useState<"whole" | "half" | "quarter">("whole");
  const [invoicePending, setInvoicePending] = useState(false);

  // ── Refund ──
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundPending, setRefundPending] = useState(false);
  const [gibletsConfirm, setGibletsConfirm] = useState(false);
  const [gibletsPending, setGibletsPending] = useState(false);

  // ── Delete ──
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: order, isLoading, isError } = useQuery<OrderDetail>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(`/api/farmops/orders/${orderId}`, { credentials: "include" });
      if (!res.ok) throw await res.json();
      return res.json();
    },
  });

  const hasDepositItems = order?.items.some((i) => i.pricingType === "deposit") ?? false;

  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ["farmops-batches"],
    queryFn: async () => {
      const res = await fetch("/api/farmops/batches", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasDepositItems && !isReadOnly,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["storefront-products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: itemsEditOpen,
  });

  // ─── Mutation helpers ────────────────────────────────────────────────────────

  async function apiFetch(path: string, method: string, body?: unknown) {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: QUERY_KEY });
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleStatusUpdate() {
    if (!newStatus) return;
    setStatusPending(true);
    try {
      await apiFetch(`/api/farmops/orders/${orderId}/status`, "PATCH", {
        status: newStatus,
        note: statusNote || undefined,
      });
      toast({ title: "Status updated" });
      setNewStatus("");
      setStatusNote("");
      invalidate();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
    } finally {
      setStatusPending(false);
    }
  }

  function openEditCustomer() {
    if (!order) return;
    setEditName(order.customerName ?? "");
    setEditEmail(order.customerEmail ?? "");
    setEditPhone(order.customerPhone ?? "");
    setEditNotes(order.notes ?? "");
    setEditPhoneError("");
    setEditOpen(true);
  }

  async function handleSaveCustomer() {
    if (editPhone.replace(/\D/g, "").length < 10) {
      setEditPhoneError("Phone must be at least 10 digits");
      return;
    }
    setEditPending(true);
    try {
      await apiFetch(`/api/farmops/orders/${orderId}`, "PATCH", {
        customerName: editName,
        customerEmail: editEmail,
        customerPhone: editPhone,
        notes: editNotes || null,
      });
      toast({ title: "Order updated" });
      setEditOpen(false);
      invalidate();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
    } finally {
      setEditPending(false);
    }
  }

  function openEditItems() {
    if (!order) return;
    setDraftItems(
      order.items.map((i) => ({
        productId: i.productId ?? 0,
        quantity: i.quantity,
        productName: i.productName,
      }))
    );
    setAddProductId("");
    setAddQty(1);
    setItemsEditOpen(true);
  }

  function addDraftItem() {
    const pid = Number(addProductId);
    if (!pid) return;
    const product = products.find((p) => p.id === pid);
    if (!product) return;
    const existing = draftItems.find((d) => d.productId === pid);
    if (existing) {
      setDraftItems(draftItems.map((d) => d.productId === pid ? { ...d, quantity: d.quantity + addQty } : d));
    } else {
      setDraftItems([...draftItems, { productId: pid, quantity: addQty, productName: product.name }]);
    }
    setAddProductId("");
    setAddQty(1);
  }

  function adjustDraftQty(productId: number, delta: number) {
    setDraftItems(
      draftItems
        .map((d) => d.productId === productId ? { ...d, quantity: d.quantity + delta } : d)
        .filter((d) => d.quantity > 0)
    );
  }

  async function handleSaveItems() {
    setItemsPending(true);
    try {
      await apiFetch(`/api/farmops/orders/${orderId}/items`, "PATCH",
        draftItems.map((d) => ({ productId: d.productId, quantity: d.quantity }))
      );
      toast({ title: "Items saved" });
      setItemsEditOpen(false);
      invalidate();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
    } finally {
      setItemsPending(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setNotePending(true);
    try {
      await apiFetch(`/api/farmops/orders/${orderId}/notes`, "POST", { body: newNote.trim() });
      toast({ title: "Note added" });
      setNewNote("");
      invalidate();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
    } finally {
      setNotePending(false);
    }
  }

  async function handleAssignBatch(batchId: number | null) {
    setBatchPending(true);
    try {
      await apiFetch(`/api/farmops/orders/${orderId}/assign-batch`, "PATCH", { batchId });
      toast({ title: batchId ? "Batch assigned" : "Batch cleared" });
      setSelectedBatchId("");
      invalidate();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
    } finally {
      setBatchPending(false);
    }
  }

  async function handleSendInvoice() {
    const w = parseFloat(invoiceWeight);
    if (!w || w <= 0) {
      toast({ title: "Enter a valid weight", variant: "destructive" });
      return;
    }
    setInvoicePending(true);
    try {
      const data = await apiFetch(`/api/farmops/orders/${orderId}/send-invoice`, "POST", {
        weightLbs: w,
        variant: invoiceVariant,
      });
      if (data.status === "deposit_covers_balance") {
        toast({ title: "Deposit covers balance", description: "No invoice needed — deposit covered the full amount." });
      } else if (data.status === "invoiced") {
        toast({ title: "Invoice sent", description: `Remaining balance: ${formatMoney(data.remainingCents)}` });
      } else {
        toast({ title: "Invoice queued (stub)", description: `Remaining: ${formatMoney(data.remainingCents)}` });
      }
      setInvoiceWeight("");
      invalidate();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
    } finally {
      setInvoicePending(false);
    }
  }

  async function handleRefund() {
    const cents = Math.round(parseFloat(refundAmount) * 100);
    if (!cents || cents <= 0) {
      toast({ title: "Enter a valid refund amount", variant: "destructive" });
      return;
    }
    setRefundPending(true);
    try {
      const data = await apiFetch(`/api/farmops/orders/${orderId}/refund`, "POST", {
        amountCents: cents,
        reason: refundReason || undefined,
      });
      toast({ title: "Refund recorded", description: data.message });
      setRefundAmount("");
      setRefundReason("");
      invalidate();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
    } finally {
      setRefundPending(false);
    }
  }

  async function handleRefundGiblets() {
    setGibletsPending(true);
    try {
      const data = await apiFetch(`/api/farmops/orders/${orderId}/refund-giblets`, "POST");
      toast({ title: "Giblets refunded", description: data.message });
      setGibletsConfirm(false);
      invalidate();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
    } finally {
      setGibletsPending(false);
    }
  }

  async function handleDelete() {
    setDeletePending(true);
    try {
      await apiFetch(`/api/farmops/orders/${orderId}`, "DELETE");
      toast({ title: "Order deleted" });
      onBack();
    } catch (e) {
      toast({ title: "Error", description: getErrMsg(e), variant: "destructive" });
      setDeletePending(false);
      setDeleteConfirm(false);
    }
  }

  // ─── Loading / error ─────────────────────────────────────────────────────────

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

  const hasGiblets = order.items.some((i) => i.isGiblets);
  const invoiceAlreadySent =
    !!order.stripeInvoiceId || order.status === "invoice_sent" || order.status === "fulfilled";
  const currentBatch = batches.find((b) => b.id === order.batchId) ?? null;

  // Invoice balance preview
  const invoiceWeightNum = parseFloat(invoiceWeight) || 0;
  const selectedBatchForInvoice = currentBatch;
  const pricePerLbForVariant = selectedBatchForInvoice
    ? invoiceVariant === "half"
      ? selectedBatchForInvoice.pricePerLbCentsHalf
      : invoiceVariant === "quarter"
      ? selectedBatchForInvoice.pricePerLbCentsQuarter
      : selectedBatchForInvoice.pricePerLbCentsWhole
    : 0;
  const depositPaidCents = order.items
    .filter((i) => i.pricingType === "deposit")
    .reduce((s, i) => s + i.lineTotalInCents, 0);
  const finalTotalCents = Math.round(invoiceWeightNum * pricePerLbForVariant);
  const remainingCents = Math.max(0, finalTotalCents - depositPaidCents);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </button>
        <span className="font-mono text-sm text-slate-400">#{String(order.id).padStart(4, "0")}</span>
        <StatusBadge status={order.status} />
        {order.source === "admin" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
            <PhoneCall className="w-3 h-3" /> Admin order
          </span>
        )}
        {isOwner && (
          <div className="ml-auto">
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                <span className="text-sm text-red-700 font-medium">Delete this order?</span>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deletePending}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deletePending ? "Deleting…" : "Confirm Delete"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Customer card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-sm">Customer</h2>
          {!isReadOnly && !editOpen && (
            <button
              onClick={openEditCustomer}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
        <div className="px-6 py-5">
          {editOpen ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`${inputCls} w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={`${inputCls} w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                <input
                  value={editPhone}
                  onChange={(e) => { setEditPhone(e.target.value); setEditPhoneError(""); }}
                  className={`${inputCls} w-full`}
                />
                {editPhoneError && <p className="text-xs text-red-500 mt-1">{editPhoneError}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className={`${inputCls} w-full resize-none`}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveCustomer}
                  disabled={editPending}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {editPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900">{order.customerName}</p>
              {order.customerEmail && <p className="text-sm text-slate-500">{order.customerEmail}</p>}
              {order.customerPhone && <p className="text-sm text-slate-500">{order.customerPhone}</p>}
              {order.notes && <p className="text-sm text-slate-400 italic mt-2">{order.notes}</p>}
              {order.pickupEventName && (
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-medium">Pickup:</span> {order.pickupEventName}
                  {order.pickupEventScheduledAt && (
                    <span className="text-slate-400 ml-1.5">
                      {format(new Date(order.pickupEventScheduledAt), "MMM d, yyyy")}
                    </span>
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 mt-3 text-sm text-slate-600">
                <span>
                  <span className="font-medium text-slate-700">Total:</span>{" "}
                  <span className="font-bold text-slate-900">{formatMoney(order.totalInCents)}</span>
                </span>
                <span className="capitalize">
                  <span className="font-medium text-slate-700">Payment:</span> {order.paymentMethod}
                </span>
                <span>
                  <span className="font-medium text-slate-700">Placed:</span>{" "}
                  {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
                {order.finalWeightLbs != null && (
                  <span>
                    <span className="font-medium text-slate-700">Final weight:</span> {order.finalWeightLbs} lbs
                  </span>
                )}
                {order.appliedCouponCode && (
                  <span>
                    <span className="font-medium text-slate-700">Coupon:</span> {order.appliedCouponCode}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status update ── */}
      {!isReadOnly && (
        <SectionCard icon={<RefreshCw className="w-4 h-4 text-emerald-600" />} title="Update Status">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select status —</option>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s} disabled={s === order.status}>
                      {STATUS_LABELS[s]}{s === order.status ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus || newStatus === order.status || statusPending}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {statusPending ? "Updating…" : "Update Status"}
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Note (optional)</label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Reason for status change…"
                rows={2}
                className={`${inputCls} w-full resize-none`}
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── Order items ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            Order Items
          </h2>
          {!isReadOnly && !itemsEditOpen && (
            <button
              onClick={openEditItems}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit Items
            </button>
          )}
        </div>

        {itemsEditOpen ? (
          <div className="px-6 py-5 space-y-4">
            {/* Draft items list */}
            {draftItems.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No items — add at least one below.</p>
            ) : (
              <div className="space-y-2">
                {draftItems.map((d) => (
                  <div key={d.productId} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                    <span className="flex-1 text-sm font-medium text-slate-900 truncate">{d.productName}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => adjustDraftQty(d.productId, -1)}
                        className="w-6 h-6 rounded flex items-center justify-center border border-slate-300 hover:bg-white transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{d.quantity}</span>
                      <button
                        onClick={() => adjustDraftQty(d.productId, 1)}
                        className="w-6 h-6 rounded flex items-center justify-center border border-slate-300 hover:bg-white transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => setDraftItems(draftItems.filter((x) => x.productId !== d.productId))}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add product row */}
            <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Add Product</label>
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select product —</option>
                  {products
                    .filter((p) => p.availability !== "disabled")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatMoney(p.priceInCents)})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Qty</label>
                <input
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
                  className={`${inputCls} w-20`}
                />
              </div>
              <button
                onClick={addDraftItem}
                disabled={!addProductId}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveItems}
                disabled={itemsPending}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {itemsPending ? "Saving…" : "Save Items"}
              </button>
              <button
                onClick={() => setItemsEditOpen(false)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : order.items.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">No items on this order.</div>
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
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <div className="space-y-1 min-w-[200px]">
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatMoney(order.totalInCents)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Activity timeline ── */}
      <SectionCard icon={<MessageSquare className="w-4 h-4 text-emerald-600" />} title="Activity">
        <div className="space-y-4">
          {order.events.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {[...order.events].reverse().map((ev) => (
                <div key={ev.id} className="flex gap-3 text-sm">
                  <span className="text-base leading-5 shrink-0">
                    {EVENT_ICONS[ev.eventType] ?? "📌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700">{ev.body}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(new Date(ev.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isReadOnly && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                className={`${inputCls} w-full resize-none`}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || notePending}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {notePending ? "Adding…" : "Add Note"}
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Batch assignment ── */}
      {!isReadOnly && hasDepositItems && (
        <SectionCard icon={<FileText className="w-4 h-4 text-emerald-600" />} title="Preorder Batch">
          <div className="space-y-3">
            {currentBatch ? (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                <span className="font-semibold text-emerald-800">{currentBatch.name}</span>
                <span className="text-emerald-600 text-xs">
                  Whole: {formatMoney(currentBatch.pricePerLbCentsWhole)}/lb ·
                  Half: {formatMoney(currentBatch.pricePerLbCentsHalf)}/lb ·
                  Quarter: {formatMoney(currentBatch.pricePerLbCentsQuarter)}/lb
                </span>
                <button
                  onClick={() => handleAssignBatch(null)}
                  disabled={batchPending}
                  className="ml-auto text-xs text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {batchPending ? "Clearing…" : "Clear"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No batch assigned.</p>
            )}
            <div className="flex gap-2 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Assign Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select batch —</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.status})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleAssignBatch(Number(selectedBatchId))}
                disabled={!selectedBatchId || batchPending}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {batchPending ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── Send invoice ── */}
      {!isReadOnly && hasDepositItems && order.batchId && !invoiceAlreadySent && (
        <SectionCard icon={<FileText className="w-4 h-4 text-emerald-600" />} title="Send Final Invoice">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Final Weight (lbs)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={invoiceWeight}
                  onChange={(e) => setInvoiceWeight(e.target.value)}
                  placeholder="e.g. 4.75"
                  className={`${inputCls} w-32`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cut</label>
                <select
                  value={invoiceVariant}
                  onChange={(e) => setInvoiceVariant(e.target.value as "whole" | "half" | "quarter")}
                  className={inputCls}
                >
                  <option value="whole">Whole</option>
                  <option value="half">Half</option>
                  <option value="quarter">Quarter</option>
                </select>
              </div>
            </div>

            {invoiceWeightNum > 0 && selectedBatchForInvoice && (
              <div className="p-3 bg-slate-50 rounded-xl text-sm space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>
                    {invoiceWeightNum} lbs × {formatMoney(pricePerLbForVariant)}/lb
                  </span>
                  <span>{formatMoney(finalTotalCents)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Deposit paid</span>
                  <span>− {formatMoney(depositPaidCents)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                  <span>Balance due</span>
                  <span>{formatMoney(remainingCents)}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleSendInvoice}
              disabled={!invoiceWeight || invoicePending}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {invoicePending ? "Sending…" : "Send Invoice"}
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── Refunds ── */}
      {!isReadOnly && (
        <SectionCard icon={<DollarSign className="w-4 h-4 text-emerald-600" />} title="Refunds">
          <div className="space-y-5">
            {/* Giblets refund */}
            {hasGiblets && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Giblets Deposit</p>
                {order.refundedGiblets ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-700">
                    ✓ Refunded
                  </span>
                ) : !gibletsConfirm ? (
                  <button
                    onClick={() => setGibletsConfirm(true)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    Refund Giblets Deposit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700">Confirm giblets refund?</span>
                    <button
                      onClick={() => setGibletsConfirm(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRefundGiblets}
                      disabled={gibletsPending}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {gibletsPending ? "Processing…" : "Confirm Refund"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Custom refund */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Custom Refund</p>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} w-28`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Reason (optional)</label>
                    <input
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="e.g. damaged goods"
                      className={`${inputCls} w-52`}
                    />
                  </div>
                </div>
                <button
                  onClick={handleRefund}
                  disabled={!refundAmount || refundPending}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {refundPending ? "Processing…" : "Issue Refund"}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
