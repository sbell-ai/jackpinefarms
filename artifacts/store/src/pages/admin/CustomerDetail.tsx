import { useParams, Link } from "wouter";
import { format } from "date-fns";
import {
  useAdminGetCustomer,
  getAdminGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, Mail, Phone, ShoppingBag, CheckCircle, XCircle } from "lucide-react";

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

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const customerId = Number(id);

  const { data: customer, isLoading, isError } = useAdminGetCustomer(customerId, {
    query: { queryKey: getAdminGetCustomerQueryKey(customerId) },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{customer.name ?? customer.email}</h1>
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</div>
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
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stats</div>
          <div className="flex items-center gap-2 text-sm">
            <ShoppingBag className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-foreground font-medium">{orders.length}</span>
            <span className="text-muted-foreground">order{orders.length !== 1 ? "s" : ""}</span>
          </div>
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
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Total</th>
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
    </div>
  );
}
