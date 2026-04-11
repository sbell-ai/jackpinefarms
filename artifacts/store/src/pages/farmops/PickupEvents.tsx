import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  Calendar,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  Globe,
  Lock,
  Users,
  MapPin,
  Send,
  ChevronRight,
} from "lucide-react";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";

// ─── Constants ─────────────────────────────────────────────────────────────────

const inputCls =
  "px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  completed: "bg-teal-100 text-teal-800",
  cancelled: "bg-red-100 text-red-800",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
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

const ORDER_STATUS_LABELS: Record<string, string> = {
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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PickupEvent {
  id: number;
  name: string;
  scheduledAt: string;
  status: string;
  isPublic: boolean;
  capacity: number | null;
  locationNotes: string | null;
  orderCount: number;
  spotsRemaining: number | null;
  createdAt: string;
}

interface OrderItem {
  orderId: number;
  productName: string;
  quantity: number;
  pricingType: string;
  lineTotalInCents: number;
  isGiblets: boolean;
}

interface EventOrder {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  paymentMethod: string;
  totalInCents: number;
  finalWeightLbs: number | null;
  batchId: number | null;
  stripeInvoiceId: string | null;
  items: OrderItem[];
}

interface EventDetail extends PickupEvent {
  orders: EventOrder[];
}

interface InvoiceEntry {
  orderId: number;
  weightLbs: string;
  variant: "whole" | "half" | "quarter";
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function OrderBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${ORDER_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-500"}`}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Pickup Event Detail ───────────────────────────────────────────────────────

function PickupEventDetail({
  eventId,
  isAdmin,
  onBack,
  onUpdated,
}: {
  eventId: number;
  isAdmin: boolean;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [assignInput, setAssignInput] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [invoiceEntries, setInvoiceEntries] = useState<Record<number, InvoiceEntry>>({});
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; errors: string[] } | null>(null);

  const [editForm, setEditForm] = useState({
    name: "",
    scheduledAt: "",
    locationNotes: "",
    capacity: "",
    status: "scheduled" as "scheduled" | "completed" | "cancelled",
  });

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ["farmops-pickup-event-detail", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/farmops/pickup-events/${eventId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load event");
      return res.json();
    },
  });

  useEffect(() => {
    if (event && !editMode) {
      setEditForm({
        name: event.name,
        scheduledAt: new Date(event.scheduledAt).toISOString().slice(0, 16),
        locationNotes: event.locationNotes ?? "",
        capacity: event.capacity != null ? String(event.capacity) : "",
        status: event.status as "scheduled" | "completed" | "cancelled",
      });
    }
  }, [event, editMode]);

  const handleSaveEdit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/farmops/pickup-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          scheduledAt: new Date(editForm.scheduledAt).toISOString(),
          locationNotes: editForm.locationNotes.trim() || null,
          capacity: editForm.capacity ? parseInt(editForm.capacity) : null,
          status: editForm.status,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save");
      }
      queryClient.invalidateQueries({ queryKey: ["farmops-pickup-event-detail", eventId] });
      queryClient.invalidateQueries({ queryKey: ["farmops-pickup-events"] });
      setEditMode(false);
      onUpdated();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignOrder = async () => {
    const trimmed = assignInput.trim();
    if (!trimmed) return;
    const orderId = parseInt(trimmed);
    if (isNaN(orderId)) { setAssignError("Please enter a valid numeric order ID"); return; }

    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/farmops/pickup-events/${eventId}/assign-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to assign order");
      }
      setAssignInput("");
      queryClient.invalidateQueries({ queryKey: ["farmops-pickup-event-detail", eventId] });
      queryClient.invalidateQueries({ queryKey: ["farmops-pickup-events"] });
    } catch (err) {
      setAssignError((err as Error).message);
    } finally {
      setAssigning(false);
    }
  };

  const handleSendInvoices = async (entries: InvoiceEntry[]) => {
    if (entries.length === 0) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/farmops/pickup-events/${eventId}/send-invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(entries.map((e) => ({
          orderId: e.orderId,
          weightLbs: parseFloat(e.weightLbs),
          variant: e.variant,
        }))),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to send invoices");
      }
      const result = await res.json();
      setSendResult(result);
      queryClient.invalidateQueries({ queryKey: ["farmops-pickup-event-detail", eventId] });
    } catch (err) {
      setSendResult({ sent: 0, errors: [(err as Error).message] });
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to events
        </button>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 text-sm">
          Failed to load event details.
        </div>
      </div>
    );
  }

  const depositOrders = event.orders.filter((o) =>
    o.items.some((i) => i.pricingType === "deposit")
  );

  const sendableEntries = depositOrders
    .filter((o) => {
      const entry = invoiceEntries[o.id];
      return entry && entry.weightLbs && parseFloat(entry.weightLbs) > 0;
    })
    .map((o) => invoiceEntries[o.id]);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to events
      </button>

      {/* Event header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {editMode ? (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 mb-4">Edit Event</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Event Name *</label>
              <input className={`${inputCls} w-full`} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date & Time *</label>
                <input type="datetime-local" className={`${inputCls} w-full`} value={editForm.scheduledAt} onChange={(e) => setEditForm((f) => ({ ...f, scheduledAt: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity</label>
                <input type="number" min="1" step="1" className={`${inputCls} w-full`} value={editForm.capacity} onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Unlimited" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Location Notes</label>
              <textarea className={`${inputCls} w-full resize-none`} rows={2} value={editForm.locationNotes} onChange={(e) => setEditForm((f) => ({ ...f, locationNotes: e.target.value }))} placeholder="Pickup address or notes" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select className={`${inputCls}`} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as "scheduled" | "completed" | "cancelled" }))}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {saveError && <p className="text-red-600 text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Save"}
              </button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <StatusBadge status={event.status} />
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${event.isPublic ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                  {event.isPublic ? <><Globe className="w-3 h-3" /> Public</> : <><Lock className="w-3 h-3" /> Draft</>}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">{event.name}</h2>
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {format(new Date(event.scheduledAt), "EEEE, MMM d, yyyy 'at' h:mm a")}
              </p>
              {event.locationNotes && (
                <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {event.locationNotes}
                </p>
              )}
              <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {event.orderCount} order{event.orderCount !== 1 ? "s" : ""}
                {event.capacity != null && ` · ${event.spotsRemaining} spots remaining`}
              </p>
            </div>
            {isAdmin && (
              <button onClick={() => setEditMode(true)} className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 transition-colors">
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Assign order (admin only) */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Assign Order to This Event</h3>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                className={`${inputCls} w-full`}
                value={assignInput}
                onChange={(e) => { setAssignInput(e.target.value); setAssignError(null); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAssignOrder())}
                placeholder="Order ID (numeric)"
                type="number"
                min="1"
              />
              {assignError && <p className="text-red-600 text-xs mt-1">{assignError}</p>}
            </div>
            <button
              onClick={handleAssignOrder}
              disabled={assigning || !assignInput.trim()}
              className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign"}
            </button>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Assigned Orders ({event.orders.length})</h3>
        </div>
        {event.orders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No orders assigned yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Deposit Paid</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Items</th>
                  {isAdmin && depositOrders.length > 0 && (
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Invoice</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {event.orders.map((order) => {
                  const isDeposit = order.items.some((i) => i.pricingType === "deposit");
                  const entry = invoiceEntries[order.id] ?? { orderId: order.id, weightLbs: order.finalWeightLbs != null ? String(order.finalWeightLbs) : "", variant: "whole" as const };

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{order.customerName}</div>
                        <div className="text-xs text-slate-400">{order.customerEmail}</div>
                        {order.customerPhone && <div className="text-xs text-slate-400">{order.customerPhone}</div>}
                        <div className="text-xs text-slate-400 font-mono">#{String(order.id).padStart(4, "0")}</div>
                      </td>
                      <td className="px-4 py-3"><OrderBadge status={order.status} /></td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(order.totalInCents)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {order.items.filter((i) => !i.isGiblets).map((item, idx) => (
                            <div key={idx} className="text-xs text-slate-600">
                              {item.quantity}× {item.productName}
                              {item.pricingType === "deposit" && (
                                <span className="ml-1 px-1 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold">Deposit</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      {isAdmin && depositOrders.length > 0 && (
                        <td className="px-4 py-3">
                          {isDeposit && order.status !== "invoice_sent" && order.status !== "fulfilled" ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="lbs"
                                className={`${inputCls} w-20`}
                                value={entry.weightLbs}
                                onChange={(e) => setInvoiceEntries((prev) => ({
                                  ...prev,
                                  [order.id]: { orderId: order.id, weightLbs: e.target.value, variant: entry.variant },
                                }))}
                              />
                              <select
                                className={`${inputCls}`}
                                value={entry.variant}
                                onChange={(e) => setInvoiceEntries((prev) => ({
                                  ...prev,
                                  [order.id]: { ...entry, variant: e.target.value as "whole" | "half" | "quarter" },
                                }))}
                              >
                                <option value="whole">Whole</option>
                                <option value="half">Half</option>
                                <option value="quarter">Quarter</option>
                              </select>
                              <button
                                onClick={() => handleSendInvoices([{ orderId: order.id, weightLbs: entry.weightLbs, variant: entry.variant }])}
                                disabled={sending || !entry.weightLbs || parseFloat(entry.weightLbs) <= 0}
                                className="p-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                                title="Send invoice"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : isDeposit ? (
                            <span className="text-xs text-teal-600 font-medium">
                              {order.status === "invoice_sent" ? "Invoice sent" : "Fulfilled"}
                              {order.finalWeightLbs != null && ` · ${order.finalWeightLbs} lbs`}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send All Invoices */}
      {isAdmin && depositOrders.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          {sendResult && (
            <div className={`mb-3 p-3 rounded-lg text-sm ${sendResult.errors.length > 0 ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
              {sendResult.sent > 0 && <p className="font-medium">{sendResult.sent} invoice{sendResult.sent !== 1 ? "s" : ""} sent successfully.</p>}
              {sendResult.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <button
            onClick={() => handleSendInvoices(sendableEntries)}
            disabled={sending || sendableEntries.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-50 transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send All Invoices ({sendableEntries.length} ready)
          </button>
          <p className="text-xs text-slate-400 mt-2">Only orders with weight entered will be invoiced.</p>
        </div>
      )}
    </div>
  );
}

// ─── Events List View ──────────────────────────────────────────────────────────

function PickupEventsListView({
  isAdmin,
  onSelect,
}: {
  isAdmin: boolean;
  onSelect: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "",
    scheduledAt: "",
    locationNotes: "",
    capacity: "",
  });

  const { data: events = [], isLoading } = useQuery<PickupEvent[]>({
    queryKey: ["farmops-pickup-events"],
    queryFn: async () => {
      const res = await fetch("/api/farmops/pickup-events", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load events");
      return res.json();
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/farmops/pickup-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          locationNotes: form.locationNotes.trim() || null,
          capacity: form.capacity ? parseInt(form.capacity) : null,
          isPublic: false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create event");
      }
      queryClient.invalidateQueries({ queryKey: ["farmops-pickup-events"] });
      setShowForm(false);
      setForm({ name: "", scheduledAt: "", locationNotes: "", capacity: "" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (id: number) => {
    setTogglingId(id);
    try {
      await fetch(`/api/farmops/pickup-events/${id}/toggle-publish`, {
        method: "PATCH",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["farmops-pickup-events"] });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pickup Events</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule and manage customer pickup events</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add Event"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4">New Pickup Event</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Event Name *</label>
              <input className={`${inputCls} w-full`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Fall 2024 Chicken Pickup" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date & Time *</label>
                <input type="datetime-local" className={`${inputCls} w-full`} value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity</label>
                <input type="number" min="1" step="1" className={`${inputCls} w-full`} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Unlimited" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Location Notes</label>
              <textarea className={`${inputCls} w-full resize-none`} rows={2} value={form.locationNotes} onChange={(e) => setForm((f) => ({ ...f, locationNotes: e.target.value }))} placeholder="Pickup address or directions" />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Create Event"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No pickup events yet.</p>
            {isAdmin && <p className="text-sm text-slate-400 mt-1">Click "Add Event" to schedule your first pickup.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Event</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Orders</th>
                  {isAdmin && <th className="text-center px-4 py-3 font-semibold text-slate-600">Published</th>}
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => onSelect(ev.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{ev.name}</div>
                      {ev.locationNotes && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {ev.locationNotes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {format(new Date(ev.scheduledAt), "MMM d, yyyy")}
                      <div className="text-xs text-slate-400">{format(new Date(ev.scheduledAt), "h:mm a")}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={ev.status} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-slate-900">{ev.orderCount}</span>
                      {ev.capacity != null && (
                        <span className="text-slate-400 text-xs"> / {ev.capacity}</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleTogglePublish(ev.id)}
                          disabled={togglingId === ev.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${ev.isPublic ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                        >
                          {togglingId === ev.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : ev.isPublic ? (
                            <><Globe className="w-3 h-3" /> Public</>
                          ) : (
                            <><Lock className="w-3 h-3" /> Draft</>
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page Root ─────────────────────────────────────────────────────────────────

export default function FarmOpsPickupEvents() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

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

  const isAdmin = session.user.role === "owner" || session.user.role === "admin";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {selectedEventId !== null ? (
        <PickupEventDetail
          eventId={selectedEventId}
          isAdmin={isAdmin}
          onBack={() => setSelectedEventId(null)}
          onUpdated={() => {}}
        />
      ) : (
        <PickupEventsListView isAdmin={isAdmin} onSelect={setSelectedEventId} />
      )}
    </div>
  );
}
