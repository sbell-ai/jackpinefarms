import { useState } from "react";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import {
  useAdminGetPickupEvent,
  getAdminGetPickupEventQueryKey,
  useAdminListOrders,
  getAdminListOrdersQueryKey,
  useAdminAssignOrderToPickupEvent,
  useAdminUpdatePickupEvent,
  useAdminSendPickupInvoices,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, Send, Pencil, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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

export default function AdminPickupEventDetail() {
  const { id } = useParams();
  const eventId = Number(id);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [assignOrderId, setAssignOrderId] = useState("");
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const { data: event, isLoading } = useAdminGetPickupEvent(eventId, {
    query: { queryKey: getAdminGetPickupEventQueryKey(eventId) },
  });

  const { data: allOrders = [] } = useAdminListOrders(
    {},
    { query: { queryKey: getAdminListOrdersQueryKey({}) } }
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: getAdminGetPickupEventQueryKey(eventId) });

  const assignOrder = useAdminAssignOrderToPickupEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order assigned to pickup event" });
        setAssignOrderId("");
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e.response?.data?.error ?? e.message, variant: "destructive" }),
    },
  });

  const updateEvent = useAdminUpdatePickupEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event updated" });
        setEditOpen(false);
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  const sendInvoices = useAdminSendPickupInvoices({
    mutation: {
      onSuccess: (data: any) => {
        toast({ title: "Invoices sent", description: data.message });
        setWeights({});
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  function openEdit() {
    if (!event) return;
    setEditName(event.name);
    setEditScheduledAt(new Date(event.scheduledAt).toISOString().slice(0, 16));
    setEditLocation((event as any).locationNotes ?? "");
    setEditStatus(event.status);
    setEditOpen(true);
  }

  function handleSendInvoices() {
    const payload = (event as any)?.orders
      ?.filter((o: any) => weights[o.id] && !isNaN(parseFloat(weights[o.id])))
      .map((o: any) => ({ orderId: o.id, weightLbs: parseFloat(weights[o.id]) }));

    if (!payload?.length) {
      toast({ title: "Enter at least one weight", variant: "destructive" });
      return;
    }
    sendInvoices.mutate({ id: eventId, data: { weights: payload } });
  }

  const assignableOrders = allOrders.filter(
    (o) => !["cancelled", "no_show", "fulfilled"].includes(o.status) &&
      !(event as any)?.orders?.some((eo: any) => eo.id === o.id)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Event not found.</p>
        <Link href="/admin/pickup-events" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to events
        </Link>
      </div>
    );
  }

  const orders: any[] = (event as any).orders ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/pickup-events">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
          <p className="text-muted-foreground text-sm">
            {format(new Date(event.scheduledAt), "EEEE, MMM d, yyyy h:mm a")}
            {(event as any).locationNotes && ` — ${(event as any).locationNotes}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Pencil className="w-4 h-4 mr-1" /> Edit
        </Button>
      </div>

      {/* Assign Order */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Assign an Order
        </div>
        <div className="flex gap-2">
          <Select value={assignOrderId} onValueChange={setAssignOrderId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select order to assign…" />
            </SelectTrigger>
            <SelectContent>
              {assignableOrders.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  #{String(o.id).padStart(4, "0")} — {o.customerName} ({o.customerEmail})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!assignOrderId || assignOrder.isPending}
            onClick={() => assignOrder.mutate({ id: eventId, data: { orderId: Number(assignOrderId) } })}
          >
            Assign
          </Button>
        </div>
        {assignableOrders.length === 0 && (
          <p className="text-xs text-muted-foreground">All eligible orders are already assigned.</p>
        )}
      </div>

      {/* Assigned Orders + Weight Entry */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">
            Assigned Orders ({orders.length})
          </div>
          {orders.length > 0 && (
            <Button size="sm" onClick={handleSendInvoices} disabled={sendInvoices.isPending}>
              <Send className="w-4 h-4 mr-1" />
              {sendInvoices.isPending ? "Sending…" : "Record Weights & Send Invoices"}
            </Button>
          )}
        </div>
        {orders.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground text-center">
            No orders assigned yet. Use the panel above to assign orders.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Order</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Final Weight (lbs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order: any) => (
                <tr key={order.id}>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    <Link href={`/admin/orders/${order.id}`} className="hover:text-primary transition-colors">
                      #{String(order.id).padStart(4, "0")}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-foreground">{order.customerName}</div>
                    <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    ${((order.totalInCents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    {order.status === "invoice_sent" || order.status === "fulfilled" ? (
                      <div className="flex items-center gap-1 text-teal-700 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        {order.finalWeightLbs ? `${order.finalWeightLbs} lbs` : "Invoiced"}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 4.25"
                        className="h-7 w-24 text-sm"
                        value={weights[order.id] ?? ""}
                        onChange={(e) => setWeights((prev) => ({ ...prev, [order.id]: e.target.value }))}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Event Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pickup Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Event Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={editScheduledAt} onChange={(e) => setEditScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Location Notes</Label>
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={!editName || !editScheduledAt || updateEvent.isPending}
              onClick={() => updateEvent.mutate({ id: eventId, data: { name: editName, scheduledAt: editScheduledAt, locationNotes: editLocation || null, status: editStatus as any } })}
            >
              {updateEvent.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
