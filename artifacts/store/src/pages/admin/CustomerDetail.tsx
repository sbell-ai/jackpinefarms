import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  useAdminGetCustomer,
  getAdminGetCustomerQueryKey,
  useAdminUpdateCustomer,
  useAdminDeleteCustomer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, ShoppingBag, CheckCircle, XCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const EVENT_ICONS: Record<string, string> = {
  status_change: "🔄",
  refund: "💸",
  note: "📝",
  invoice_sent: "📧",
  pickup_assigned: "📅",
  weights_entered: "⚖️",
};

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const customerId = Number(id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: customer, isLoading, isError } = useAdminGetCustomer(customerId, {
    query: { queryKey: getAdminGetCustomerQueryKey(customerId) },
  });

  const updateCustomer = useAdminUpdateCustomer({
    mutation: {
      onSuccess: () => {
        toast({ title: "Customer updated" });
        setEditOpen(false);
        qc.invalidateQueries({ queryKey: getAdminGetCustomerQueryKey(customerId) });
      },
      onError: (e: any) => toast({ title: "Error", description: e.response?.data?.error ?? e.message, variant: "destructive" }),
    },
  });

  const deleteCustomer = useAdminDeleteCustomer({
    mutation: {
      onSuccess: () => {
        toast({ title: "Customer deleted" });
        navigate("/admin/customers");
      },
      onError: (e: any) => {
        const msg = e.response?.data?.error ?? e.message;
        toast({ title: "Cannot delete", description: msg, variant: "destructive" });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Customer not found.</p>
        <Link href="/admin/customers" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to customers
        </Link>
      </div>
    );
  }

  const orders: any[] = (customer as any).orders ?? [];
  const eventTimeline: any[] = (customer as any).eventTimeline ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/customers">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{customer.name ?? customer.email}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setEditName(customer.name ?? "");
              setEditEmail(customer.email ?? "");
              setEditPhone(customer.phone ?? "");
              setEditNotes((customer as any).notes ?? "");
              setEditOpen(true);
            }}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {customer.name ?? customer.email}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this customer. If they have orders, deletion will be blocked.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteCustomer.mutate({ id: customerId })}
                >
                  {deleteCustomer.isPending ? "Deleting…" : "Delete Customer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</div>
          {editOpen ? (
            <div className="space-y-2">
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
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={updateCustomer.isPending}
                  onClick={() => updateCustomer.mutate({
                    id: customerId,
                    data: {
                      name: editName || undefined,
                      email: editEmail || null,
                      phone: editPhone || null,
                      notes: editNotes || null,
                    },
                  })}
                >
                  {updateCustomer.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                {customer.email}
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  {customer.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {(customer as any).emailVerified ? (
                  <><CheckCircle className="w-4 h-4 text-teal-600" /> Email verified</>
                ) : (
                  <><XCircle className="w-4 h-4 text-yellow-600" /> Email not verified</>
                )}
              </div>
              {(customer as any).notes && (
                <div className="text-sm text-muted-foreground italic">{(customer as any).notes}</div>
              )}
            </>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stats</div>
          <div className="flex items-center gap-2 text-sm">
            <ShoppingBag className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-foreground font-medium">{orders.length}</span>
            <span className="text-muted-foreground">order{orders.length !== 1 ? "s" : ""}</span>
          </div>
          {orders.filter((o: any) => o.refundedGiblets).length > 0 && (
            <div className="text-sm text-muted-foreground">
              💸 {orders.filter((o: any) => o.refundedGiblets).length} giblets refund{orders.filter((o: any) => o.refundedGiblets).length !== 1 ? "s" : ""}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Joined {format(new Date(customer.createdAt), "MMM d, yyyy")}
          </div>
        </div>
      </div>

      {/* Order History */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold text-foreground">Order History ({orders.length})</div>
        </div>
        {orders.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground text-center">
            No orders yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Order</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Payment</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Deposit</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Weight</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order: any) => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    <Link href={`/admin/orders/${order.id}`} className="hover:text-primary transition-colors">
                      #{String(order.id).padStart(4, "0")}
                    </Link>
                    {order.refundedGiblets && (
                      <span className="ml-1 text-yellow-600" title="Giblets refunded">💸</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {format(new Date(order.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">
                    {order.paymentMethod}
                  </td>
                  <td className="px-4 py-2 font-medium text-foreground">
                    ${((order.totalInCents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {order.finalWeightLbs ? `${order.finalWeightLbs} lbs` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold text-foreground">
            Activity Timeline ({eventTimeline.length} events across all orders)
          </div>
        </div>
        {eventTimeline.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            No activity yet.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {eventTimeline.map((ev: any) => (
              <div key={ev.id} className="px-4 py-3 flex gap-3 items-start">
                <span className="text-base leading-none mt-0.5 shrink-0">
                  {EVENT_ICONS[ev.eventType] ?? "📌"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/orders/${ev.orderId}`}
                      className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                    >
                      #{String(ev.orderId).padStart(4, "0")}
                    </Link>
                    <span className="text-xs text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">
                      {ev.eventType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-sm text-foreground mt-0.5">{ev.body}</div>
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
