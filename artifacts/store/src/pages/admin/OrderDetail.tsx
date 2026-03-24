import { useState } from "react";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import {
  useAdminGetOrder,
  getAdminGetOrderQueryKey,
  useAdminGetOrderEvents,
  getAdminGetOrderEventsQueryKey,
  useAdminUpdateOrderStatus,
  useAdminRefundGiblets,
  useAdminAddOrderNote,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, FileText, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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

const ALL_STATUSES = [
  "pending_payment", "deposit_paid", "cash_pending", "pickup_assigned",
  "weights_entered", "invoice_sent", "fulfilled", "cancelled", "no_show",
] as const;

const EVENT_TYPE_ICONS: Record<string, string> = {
  status_change: "🔄",
  refund: "💸",
  note: "📝",
  invoice_sent: "📧",
  pickup_assigned: "📅",
  weights_entered: "⚖️",
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [newNote, setNewNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");

  const { data: order, isLoading } = useAdminGetOrder(orderId, {
    query: { queryKey: getAdminGetOrderQueryKey(orderId) },
  });

  const { data: events = [] } = useAdminGetOrderEvents(orderId, {
    query: { queryKey: getAdminGetOrderEventsQueryKey(orderId) },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getAdminGetOrderQueryKey(orderId) });
    qc.invalidateQueries({ queryKey: getAdminGetOrderEventsQueryKey(orderId) });
  };

  const updateStatus = useAdminUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: "Status updated" });
        setNewStatus("");
        setStatusNote("");
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  const refundGiblets = useAdminRefundGiblets({
    mutation: {
      onSuccess: (data: any) => {
        toast({ title: "Giblets refunded", description: data.message });
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e.response?.data?.error ?? e.message, variant: "destructive" }),
    },
  });

  const addNote = useAdminAddOrderNote({
    mutation: {
      onSuccess: () => {
        toast({ title: "Note added" });
        setNewNote("");
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Order not found.</p>
        <Link href="/admin/orders" className="text-primary hover:underline text-sm mt-2 inline-block">Back to orders</Link>
      </div>
    );
  }

  const hasGiblets = (order as any).items?.some((i: any) => i.isGiblets);
  const refundedGiblets = (order as any).refundedGiblets;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          Order #{String(orderId).padStart(4, "0")}
        </h1>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800"}`}>
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Customer</div>
          <div className="font-medium text-foreground">{order.customerName}</div>
          <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
          {(order as any).customerPhone && (
            <div className="text-sm text-muted-foreground">{(order as any).customerPhone}</div>
          )}
        </div>

        {/* Order Info */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</div>
          <div className="text-sm text-muted-foreground">Payment: <span className="text-foreground capitalize">{order.paymentMethod}</span></div>
          <div className="text-sm text-muted-foreground">Total: <span className="text-foreground font-medium">${((order.totalInCents ?? 0) / 100).toFixed(2)}</span></div>
          <div className="text-sm text-muted-foreground">Placed: {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}</div>
          {(order as any).finalWeightLbs && (
            <div className="text-sm text-muted-foreground">Final Weight: <span className="text-foreground">{(order as any).finalWeightLbs} lbs</span></div>
          )}
        </div>
      </div>

      {/* Order Items */}
      {(order as any).items?.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold text-foreground">Items</div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Product</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Price</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(order as any).items.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-foreground">
                    {item.productName}
                    {item.isGiblets && <span className="ml-1 text-xs text-muted-foreground">(giblets)</span>}
                    {item.variantLabel && <span className="ml-1 text-xs text-muted-foreground">— {item.variantLabel}</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{item.quantity}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">${(item.unitPriceInCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-medium">${(item.lineTotalInCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Update Status */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Update Status
          </div>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Choose new status…" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Optional note…"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <Button
            size="sm"
            disabled={!newStatus || updateStatus.isPending}
            onClick={() => updateStatus.mutate({ id: orderId, data: { status: newStatus as any, note: statusNote || undefined } })}
          >
            {updateStatus.isPending ? "Saving…" : "Save Status"}
          </Button>
        </div>

        {/* Giblets Refund */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" /> Giblets Refund
          </div>
          {!hasGiblets ? (
            <p className="text-sm text-muted-foreground">This order does not include giblets.</p>
          ) : refundedGiblets ? (
            <div className="flex items-center gap-2 text-sm text-teal-700">
              <CheckCircle className="w-4 h-4" />
              Giblets refund already processed.
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Refund the $2.00 giblets deposit to the customer.</p>
              <Button
                size="sm"
                variant="outline"
                disabled={refundGiblets.isPending}
                onClick={() => refundGiblets.mutate({ id: orderId })}
              >
                {refundGiblets.isPending ? "Processing…" : "Refund $2.00 Giblets"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Add Note */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Add Note
        </div>
        <Textarea
          placeholder="Write a note about this order…"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
          className="text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!newNote.trim() || addNote.isPending}
          onClick={() => addNote.mutate({ id: orderId, data: { body: newNote.trim() } })}
        >
          {addNote.isPending ? "Saving…" : "Add Note"}
        </Button>
      </div>

      {/* Event Timeline */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold text-foreground">Activity Timeline</div>
        </div>
        {events.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">No events yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((ev: any) => (
              <div key={ev.id} className="px-4 py-3 flex gap-3 items-start">
                <span className="text-base leading-none mt-0.5">
                  {EVENT_TYPE_ICONS[ev.eventType] ?? "📌"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground">{ev.body}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(ev.createdAt), "MMM d, yyyy h:mm a")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
