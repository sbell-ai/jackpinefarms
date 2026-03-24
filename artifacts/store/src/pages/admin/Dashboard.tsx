import { useAdminListOrders, getAdminListOrdersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ShoppingBag, Layers, CalendarDays, Users, ArrowRight, AlertCircle } from "lucide-react";

const STATUS_GROUPS = [
  { label: "Pending Payment", statuses: ["pending_payment"], color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  { label: "Deposit Paid", statuses: ["deposit_paid"], color: "text-green-700 bg-green-50 border-green-200" },
  { label: "Cash Pending", statuses: ["cash_pending"], color: "text-blue-700 bg-blue-50 border-blue-200" },
  { label: "Pickup Assigned", statuses: ["pickup_assigned"], color: "text-purple-700 bg-purple-50 border-purple-200" },
  { label: "Invoice Sent", statuses: ["invoice_sent", "weights_entered"], color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  { label: "Fulfilled", statuses: ["fulfilled"], color: "text-teal-700 bg-teal-50 border-teal-200" },
  { label: "Cancelled / No Show", statuses: ["cancelled", "no_show"], color: "text-red-700 bg-red-50 border-red-200" },
];

const QUICK_LINKS = [
  { href: "/admin/orders", label: "View All Orders", icon: ShoppingBag, description: "Browse and manage every order" },
  { href: "/admin/batches", label: "Preorder Batches", icon: Layers, description: "Manage meat preorder batches" },
  { href: "/admin/pickup-events", label: "Pickup Events", icon: CalendarDays, description: "Schedule pickups & send invoices" },
  { href: "/admin/customers", label: "Customers", icon: Users, description: "View customer accounts & history" },
];

export default function AdminDashboard() {
  const { data, isLoading } = useAdminListOrders(
    { limit: 1000 },
    { query: { queryKey: getAdminListOrdersQueryKey({ limit: 1000 }) } }
  );

  const orders: any[] = data ?? [];

  const countByStatus = (statuses: string[]) =>
    orders.filter((o) => statuses.includes(o.status)).length;

  const needsPickupAssignment = orders.filter(
    (o) =>
      (o.status === "deposit_paid" || o.status === "cash_pending") &&
      !o.pickupEventId
  );

  const needsWeights = orders.filter(
    (o) => o.status === "pickup_assigned" && !o.finalWeightLbs
  );

  const actionItems = [
    {
      label: "Needs Pickup Assignment",
      count: needsPickupAssignment.length,
      description: "Paid orders not yet assigned to a pickup event",
      href: "/admin/pickup-events",
      urgency: needsPickupAssignment.length > 0 ? "high" : "none",
    },
    {
      label: "Needs Weights Entered",
      count: needsWeights.length,
      description: "Pickup-assigned orders awaiting final weight entry",
      href: "/admin/pickup-events",
      urgency: needsWeights.length > 0 ? "medium" : "none",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back to FarmOps.</p>
      </div>

      {/* Action Items */}
      {!isLoading && actionItems.some((a) => a.count > 0) && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Action Required
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {actionItems.filter((a) => a.count > 0).map((item) => (
              <Link key={item.label} href={item.href}>
                <div
                  className={`rounded-lg border p-4 cursor-pointer hover:shadow-sm transition-all ${
                    item.urgency === "high"
                      ? "border-amber-300 bg-amber-50 hover:border-amber-400"
                      : "border-blue-200 bg-blue-50 hover:border-blue-300"
                  }`}
                >
                  <div className={`text-3xl font-bold ${item.urgency === "high" ? "text-amber-700" : "text-blue-700"}`}>
                    {item.count}
                  </div>
                  <div className={`text-xs font-semibold mt-1 ${item.urgency === "high" ? "text-amber-800" : "text-blue-800"}`}>
                    {item.label}
                  </div>
                  <div className={`text-xs mt-0.5 ${item.urgency === "high" ? "text-amber-600" : "text-blue-600"}`}>
                    {item.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Order Status Summary */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Orders by Status
        </h2>
        {isLoading ? (
          <div className="h-24 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {STATUS_GROUPS.map((group) => {
              const count = countByStatus(group.statuses);
              return (
                <div
                  key={group.label}
                  className={`rounded-lg border p-4 ${group.color}`}
                >
                  <div className="text-3xl font-bold">{count}</div>
                  <div className="text-xs font-medium mt-1">{group.label}</div>
                </div>
              );
            })}
            <div className="rounded-lg border border-border p-4 bg-card">
              <div className="text-3xl font-bold text-foreground">{orders.length}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">Total Orders</div>
            </div>
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Quick Navigation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{link.label}</div>
                    <div className="text-xs text-muted-foreground">{link.description}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
