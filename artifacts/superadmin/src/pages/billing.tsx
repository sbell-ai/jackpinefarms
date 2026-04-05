import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const PLAN_PRICES: Record<string, number> = { starter: 29, growth: 79, pro: 149 };

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    trialing: "bg-blue-100 text-blue-800",
    past_due: "bg-yellow-100 text-yellow-800",
    canceled: "bg-gray-100 text-gray-600",
    paused: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    starter: "bg-slate-100 text-slate-700",
    growth: "bg-blue-100 text-blue-700",
    pro: "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${map[plan] ?? "bg-gray-100 text-gray-600"}`}>
      {plan}
    </span>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function Billing() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["billing"],
    queryFn: api.billing,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>Failed to load billing data.</p>
        </div>
      </div>
    );
  }

  const { counts, mrr, tenants } = data;

  const planBreakdown = tenants
    .filter((t) => t.status === "active")
    .reduce((acc, t) => {
      acc[t.plan] = (acc[t.plan] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Revenue and subscription overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Recurring Revenue</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{fmt(mrr)}</p>
                <p className="text-xs text-muted-foreground mt-1">{counts.active} active subscribers</p>
              </div>
              <TrendingUp className="h-5 w-5 text-green-600 mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Status Breakdown</p>
            <div className="space-y-1.5 text-sm">
              {[
                { key: "active", label: "Active", color: "text-green-700" },
                { key: "trialing", label: "Trialing", color: "text-blue-700" },
                { key: "past_due", label: "Past Due", color: "text-yellow-700" },
                { key: "paused", label: "Paused", color: "text-purple-700" },
                { key: "canceled", label: "Canceled", color: "text-gray-500" },
              ].map(({ key, label, color }) => (
                <div key={key} className="flex justify-between">
                  <span className={color}>{label}</span>
                  <span className="font-medium">{counts[key as keyof typeof counts] ?? 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Plan Breakdown (active)</p>
            <div className="space-y-1.5 text-sm">
              {(["starter", "growth", "pro"] as const).map((p) => {
                const n = planBreakdown[p] ?? 0;
                return (
                  <div key={p} className="flex justify-between">
                    <span className="capitalize">{p}</span>
                    <div className="text-right">
                      <span className="font-medium">{n}</span>
                      <span className="text-muted-foreground text-xs ml-1">({fmt(n * PLAN_PRICES[p])})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tenants.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No tenants yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tenant</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">MRR</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Stripe ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenants.map((t) => (
                    <Link key={t.id} href={`/tenants/${t.id}`}>
                      <tr className="hover:bg-muted/40 cursor-pointer transition-colors">
                        <td className="px-6 py-3">
                          <p className="font-medium text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.ownerEmail}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                        <td className="px-4 py-3"><PlanBadge plan={t.plan} /></td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {t.status === "active" ? fmt(PLAN_PRICES[t.plan] ?? 0) : "-"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                          {t.stripeSubscriptionId ? (
                            <span className="font-mono">{t.stripeSubscriptionId.slice(0, 14)}...</span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                          {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
