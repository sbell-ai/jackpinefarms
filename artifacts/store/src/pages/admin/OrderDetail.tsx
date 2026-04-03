import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  useAdminGetOrder,
  getAdminGetOrderQueryKey,
  useAdminGetOrderEvents,
  getAdminGetOrderEventsQueryKey,
  useAdminUpdateOrderStatus,
  useAdminRefundGiblets,
  useAdminAddOrderNote,
  useAdminListBatches,
  useAdminAssignOrderBatch,
  useAdminAllocateEggs,
  useAdminGetEggAllocations,
  getAdminGetEggAllocationsQueryKey,
  useAdminSendOrderInvoice,
  useAdminUpdateOrder,
  useAdminDeleteOrder,
  useAdminSetOrderItems,
  useAdminRefundOrder,
  useListProducts,
  useAdminListPickupEvents,
  type OrderStatus,
  type SendOrderInvoiceResponse,
  type PickupEvent,
  type Product,
  type SuccessResponse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, FileText, CheckCircle, XCircle, MessageSquare, Package, Egg, Send, DollarSign, PhoneCall, Pencil, Trash2, Plus, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

function getApiErrMsg(e: unknown): string {
  const ae = e as { response?: { data?: { error?: string } }; message?: string };
  return ae?.response?.data?.error ?? ae?.message ?? "Unknown error";
}

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
  const [, navigate] = useLocation();

  const [newNote, setNewNote] = useState("");
  const [newStatus, setNewStatus] = useState<OrderStatus | "">("");
  const [statusNote, setStatusNote] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [invoiceWeightLbs, setInvoiceWeightLbs] = useState("");
  const [invoiceVariant, setInvoiceVariant] = useState<"whole" | "half" | "quarter">("whole");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPickupEventId, setEditPickupEventId] = useState<number | null | undefined>(undefined);

  const [itemsEditOpen, setItemsEditOpen] = useState(false);
  type DraftItem = { productId: number; quantity: number; productName: string };
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addProductQty, setAddProductQty] = useState(1);

  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

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
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
    },
  });

  const refundGiblets = useAdminRefundGiblets({
    mutation: {
      onSuccess: (data: SuccessResponse) => {
        toast({ title: "Giblets refunded", description: data.message });
        invalidate();
      },
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
    },
  });

  const addNote = useAdminAddOrderNote({
    mutation: {
      onSuccess: () => {
        toast({ title: "Note added" });
        setNewNote("");
        invalidate();
      },
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
    },
  });

  const { data: batches = [] } = useAdminListBatches();

  const assignBatch = useAdminAssignOrderBatch({
    mutation: {
      onSuccess: () => {
        toast({ title: "Batch assigned" });
        setSelectedBatchId("");
        invalidate();
      },
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
    },
  });

  const { data: eggAllocations = [], refetch: refetchAllocations } =
    useAdminGetEggAllocations(orderId, {
      query: { queryKey: getAdminGetEggAllocationsQueryKey(orderId) },
    });

  const allocateEggs = useAdminAllocateEggs({
    mutation: {
      onSuccess: () => {
        toast({ title: "Eggs allocated" });
        qc.invalidateQueries({
          queryKey: getAdminGetEggAllocationsQueryKey(orderId),
        });
      },
      onError: (e: unknown) => {
        const ae = e as { response?: { status?: number; data?: { error?: string } }; message?: string };
        if (ae.response?.status === 409) {
          toast({ title: "Already allocated", description: "Egg inventory already allocated for this order." });
          refetchAllocations();
          return;
        }
        toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" });
      },
    },
  });

  const sendInvoice = useAdminSendOrderInvoice({
    mutation: {
      onSuccess: (data: SendOrderInvoiceResponse) => {
        if (data.status === "deposit_covers_balance") {
          toast({ title: "Deposit covers balance", description: "No invoice needed — deposit covered the full amount." });
        } else if (data.status === "invoiced") {
          toast({ title: "Invoice sent", description: `Stripe invoice sent to ${order?.customerEmail}. Remaining balance: $${(data.remainingCents / 100).toFixed(2)}` });
        } else {
          toast({ title: "Invoice queued (stub)", description: `STRIPE_SECRET_KEY not set. Remaining: $${(data.remainingCents / 100).toFixed(2)}` });
        }
        setInvoiceWeightLbs("");
        invalidate();
      },
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
    },
  });

  const updateOrder = useAdminUpdateOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order updated" });
        setEditOpen(false);
        invalidate();
      },
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
    },
  });

  const deleteOrder = useAdminDeleteOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order deleted" });
        navigate("/admin/orders");
      },
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
    },
  });

  const { data: allProducts = [] } = useListProducts();
  const { data: pickupEvents = [] } = useAdminListPickupEvents();

  const setOrderItems = useAdminSetOrderItems({
    mutation: {
      onSuccess: () => {
        toast({ title: "Items saved" });
        setItemsEditOpen(false);
        invalidate();
      },
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
    },
  });

  const refundOrder = useAdminRefundOrder({
    mutation: {
      onSuccess: (data: SuccessResponse) => {
        toast({ title: "Refund recorded", description: data.message });
        setRefundAmount("");
        setRefundReason("");
        invalidate();
      },
      onError: (e: unknown) => toast({ title: "Error", description: getApiErrMsg(e), variant: "destructive" }),
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

  const hasGiblets = order.items.some((i) => i.isGiblets);
  const refundedGiblets = order.refundedGiblets;
  const hasDepositItems = order.items.some((i) => i.pricingType === "deposit");
  const invoiceAlreadySent = !!order.stripeInvoiceId || order.status === "invoice_sent" || order.status === "fulfilled";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
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
        {order.source === "admin" && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
            <PhoneCall className="w-3 h-3" /> Admin order
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete order #{String(orderId).padStart(4, "0")}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the order and all its items. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteOrder.mutate({ id: orderId })}
                >
                  {deleteOrder.isPending ? "Deleting…" : "Delete Order"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditName(order.customerName ?? "");
                setEditEmail(order.customerEmail ?? "");
                setEditPhone(order.customerPhone ?? "");
                setEditNotes(order.notes ?? "");
                setEditPickupEventId(order.pickupEventId ?? null);
                setEditOpen(true);
              }}
            >
              <Pencil className="w-3 h-3" /> Edit
            </Button>
          </div>
          {editOpen ? (
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Name</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm h-8" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Email</label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="text-sm h-8" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Phone</label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="text-sm h-8" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Pickup Event</label>
                <Select
                  value={editPickupEventId != null ? String(editPickupEventId) : "__none__"}
                  onValueChange={(v) => setEditPickupEventId(v === "__none__" ? null : Number(v))}
                >
                  <SelectTrigger className="text-sm h-8">
                    <SelectValue placeholder="No pickup event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No pickup event —</SelectItem>
                    {pickupEvents.map((ev: PickupEvent) => (
                      <SelectItem key={ev.id} value={String(ev.id)}>
                        {ev.name} {ev.scheduledAt ? `(${format(new Date(ev.scheduledAt), "MMM d, yyyy")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={updateOrder.isPending}
                  onClick={() => updateOrder.mutate({
                    id: orderId,
                    data: {
                      customerName: editName || undefined,
                      customerEmail: editEmail || undefined,
                      customerPhone: editPhone || undefined,
                      notes: editNotes || null,
                      pickupEventId: editPickupEventId,
                    },
                  })}
                >
                  {updateOrder.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="font-medium text-foreground">{order.customerName}</div>
              <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
              {order.customerPhone && (
                <div className="text-sm text-muted-foreground">{order.customerPhone}</div>
              )}
              {order.notes && (
                <div className="text-sm text-muted-foreground italic mt-1">{order.notes}</div>
              )}
            </>
          )}
        </div>

        {/* Order Info */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</div>
          <div className="text-sm text-muted-foreground">Payment: <span className="text-foreground capitalize">{order.paymentMethod}</span></div>
          <div className="text-sm text-muted-foreground">Total: <span className="text-foreground font-medium">${((order.totalInCents ?? 0) / 100).toFixed(2)}</span></div>
          <div className="text-sm text-muted-foreground">Placed: {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}</div>
          {order.finalWeightLbs != null && (
            <div className="text-sm text-muted-foreground">Final Weight: <span className="text-foreground">{order.finalWeightLbs} lbs</span></div>
          )}
          {order.pickupEventName && order.pickupEventId != null && (
            <div className="text-sm text-muted-foreground">
              Pickup Event:{" "}
              <Link href={`/admin/pickup-events/${order.pickupEventId}`} className="text-foreground font-medium hover:text-primary underline underline-offset-2 transition-colors">
                {order.pickupEventName}
              </Link>
              {order.pickupEventScheduledAt && (
                <span className="ml-1 text-xs">({format(new Date(order.pickupEventScheduledAt), "MMM d, yyyy")})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Order Items */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Items</div>
          {!itemsEditOpen ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setDraftItems(order.items.filter((i) => i.productId != null).map((i) => ({ productId: i.productId as number, quantity: i.quantity, productName: i.productName ?? "" })));
                setAddProductId("");
                setAddProductQty(1);
                setItemsEditOpen(true);
              }}
            >
              <Pencil className="w-3 h-3" /> Edit Items
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                size="sm"
                disabled={setOrderItems.isPending}
                onClick={() => setOrderItems.mutate({ id: orderId, data: draftItems.map((i) => ({ productId: i.productId, quantity: i.quantity })) })}
              >
                {setOrderItems.isPending ? "Saving…" : "Save Items"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setItemsEditOpen(false)}>Cancel</Button>
            </div>
          )}
        </div>

        {itemsEditOpen ? (
          <div className="p-4 space-y-3">
            {draftItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No items yet. Add a product below.</p>
            )}
            {draftItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-foreground">{item.productName}</span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    disabled={item.quantity <= 1}
                    onClick={() => setDraftItems((prev) => prev.map((d, i) => i === idx ? { ...d, quantity: d.quantity - 1 } : d))}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => setDraftItems((prev) => prev.map((d, i) => i === idx ? { ...d, quantity: d.quantity + 1 } : d))}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDraftItems((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex items-center gap-2">
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger className="flex-1 text-sm h-8">
                  <SelectValue placeholder="Add a product…" />
                </SelectTrigger>
                <SelectContent>
                  {allProducts
                    .filter((p: Product) => !draftItems.some((d) => d.productId === p.id))
                    .map((p: Product) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={addProductQty <= 1} onClick={() => setAddProductQty((q) => q - 1)}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">{addProductQty}</span>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setAddProductQty((q) => q + 1)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!addProductId}
                onClick={() => {
                  const prod = allProducts.find((p: Product) => p.id === Number(addProductId));
                  if (!prod) return;
                  setDraftItems((prev) => [...prev, { productId: prod.id, quantity: addProductQty, productName: prod.name }]);
                  setAddProductId("");
                  setAddProductQty(1);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        ) : order.items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">No items on this order.</div>
        ) : (
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
              {order.items.map((item) => (
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
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Update Status */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Update Status
          </div>
          <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus | "")}>
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
            onClick={() => updateStatus.mutate({ id: orderId, data: { status: newStatus as OrderStatus, note: statusNote || undefined } })}
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

      {/* Preorder Batch Assignment */}
      {order.items.some((i) => i.pricingType === "deposit") && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4" /> Preorder Batch
          </div>
          {order.batchId != null ? (
            <div className="text-sm text-muted-foreground">
              Currently assigned to batch ID{" "}
              <span className="font-medium text-foreground">#{order.batchId}</span>.
              {" "}Reassign below if needed.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This order has deposit items but is not assigned to a preorder batch. Assign a batch so final invoice pricing is available.
            </p>
          )}
          <div className="flex gap-2">
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a preorder batch…" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name} — Whole: ${(b.pricePerLbCentsWhole / 100).toFixed(2)}/lb
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!selectedBatchId || assignBatch.isPending}
              onClick={() => assignBatch.mutate({ id: orderId, data: { batchId: Number(selectedBatchId) } })}
            >
              {assignBatch.isPending ? "Saving…" : "Assign Batch"}
            </Button>
          </div>
        </div>
      )}

      {/* Egg Inventory Allocation */}
      {order.items.some((i) =>
        i.productName?.toLowerCase().includes("egg"),
      ) && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Egg className="w-4 h-4" /> Egg Inventory Allocation
          </div>
          {eggAllocations.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-teal-700">
                <CheckCircle className="w-4 h-4" />
                Eggs allocated from inventory.
              </div>
              <div className="rounded border border-border overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Egg Type</th>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Lot Date</th>
                      <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {eggAllocations.map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-1.5 text-foreground">{a.eggTypeName}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{a.lotDate}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{a.allocatedQtyEach}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Allocate egg inventory from stock using FIFO lot order.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={allocateEggs.isPending}
                onClick={() => allocateEggs.mutate({ orderId })}
              >
                {allocateEggs.isPending ? "Allocating…" : "Allocate Eggs"}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Send Final Invoice */}
      {hasDepositItems && order.batchId != null && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Send className="w-4 h-4" /> Final Invoice
          </div>

          {invoiceAlreadySent ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-teal-700">
                <CheckCircle className="w-4 h-4" />
                Invoice already sent.
              </div>
              {order.stripeInvoiceId && (
                <div className="text-xs text-muted-foreground">
                  Stripe invoice ID: <span className="font-mono">{order.stripeInvoiceId}</span>
                </div>
              )}
              {order.finalWeightLbs != null && (
                <div className="text-xs text-muted-foreground">
                  Final weight on file: {order.finalWeightLbs} lbs
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Enter the final dressed weight to calculate the remaining balance. The invoice will be sent to the customer via Stripe.
              </p>

              {/* Weight + variant row */}
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">Final Weight (lbs)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="e.g. 5.2"
                    value={invoiceWeightLbs}
                    onChange={(e) => setInvoiceWeightLbs(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="w-36">
                  <label className="block text-xs text-muted-foreground mb-1">Variant</label>
                  <Select value={invoiceVariant} onValueChange={(v) => setInvoiceVariant(v as "whole" | "half" | "quarter")}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whole">Whole</SelectItem>
                      <SelectItem value="half">Half</SelectItem>
                      <SelectItem value="quarter">Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Live balance preview */}
              {(() => {
                const batch = batches.find((b) => b.id === order.batchId);
                const depositPaid = order.items
                  .filter((i) => i.pricingType === "deposit")
                  .reduce((s, i) => s + i.lineTotalInCents, 0);
                const pricePerLbCents = batch
                  ? (invoiceVariant === "half" ? batch.pricePerLbCentsHalf
                    : invoiceVariant === "quarter" ? batch.pricePerLbCentsQuarter
                    : batch.pricePerLbCentsWhole)
                  : 0;
                const wt = parseFloat(invoiceWeightLbs);
                if (!batch || isNaN(wt) || wt <= 0) return null;
                const finalTotal = Math.round(wt * pricePerLbCents);
                const remaining = Math.max(0, finalTotal - depositPaid);
                return (
                  <div className="rounded-md bg-muted/40 border border-border p-3 text-sm space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{wt} lbs × ${(pricePerLbCents / 100).toFixed(2)}/lb</span>
                      <span className="text-foreground font-medium">${(finalTotal / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Deposit paid</span>
                      <span>− ${(depositPaid / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
                      <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />Balance due</span>
                      <span className={remaining === 0 ? "text-teal-700" : "text-foreground"}>
                        {remaining === 0 ? "Fully covered" : `$${(remaining / 100).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <Button
                size="sm"
                disabled={!invoiceWeightLbs || parseFloat(invoiceWeightLbs) <= 0 || sendInvoice.isPending}
                onClick={() =>
                  sendInvoice.mutate({
                    id: orderId,
                    data: { weightLbs: parseFloat(invoiceWeightLbs), variant: invoiceVariant },
                  })
                }
              >
                {sendInvoice.isPending ? "Sending…" : "Send Invoice"}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Admin Refund */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Issue Refund
        </div>
        <p className="text-sm text-muted-foreground">
          Record a refund of any amount. If Stripe is configured and this order was paid via Stripe, the refund will be processed automatically.
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">Amount (dollars)</label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 5.00"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="text-sm h-8"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">Reason (optional)</label>
            <Input
              placeholder="e.g. Wrong product"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="text-sm h-8"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0"
            disabled={!refundAmount || parseFloat(refundAmount) <= 0 || refundOrder.isPending}
            onClick={() => refundOrder.mutate({
              id: orderId,
              data: {
                amountCents: Math.round(parseFloat(refundAmount) * 100),
                reason: refundReason || undefined,
              },
            })}
          >
            {refundOrder.isPending ? "Processing…" : "Process Refund"}
          </Button>
        </div>
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
            {events.map((ev) => (
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
