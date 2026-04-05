import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

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

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
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
          <p>Failed to load dashboard data.</p>
        </div>
      </div>
    );
  }

  const { counts, mrr, trialsExpiring, recentSignups } = data;

  const stats = [
    { label: "Total Tenants", value: counts.total, icon: Users, color: "text-blue-600" },
    { label: "Active", value: counts.active, icon: TrendingUp, color: "text-green-600" },
    { label: "Trialing", value: counts.trialing, icon: Clock, color: "text-blue-500" },
    {
      label: "MRR",
      value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(mrr),
      icon: TrendingUp,
      color: "text-indigo-600",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
                </div>
                <Icon className={`h-5 w-5 ${color} mt-1`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {counts.past_due > 0 || counts.paused > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {counts.past_due > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-xs text-yellow-700 uppercase tracking-wide">Past Due</p>
              <p className="text-xl font-bold text-yellow-800 mt-0.5">{counts.past_due}</p>
            </div>
          )}
          {counts.paused > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
              <p className="text-xs text-purple-700 uppercase tracking-wide">Paused</p>
              <p className="text-xl font-bold text-purple-800 mt-0.5">{counts.paused}</p>
            </div>
          )}
          {counts.canceled > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-600 uppercase tracking-wide">Canceled</p>
              <p className="text-xl font-bold text-gray-700 mt-0.5">{counts.canceled}</p>
            </div>
          )}
        </div>
      ) : null}

      {trialsExpiring.length > 0 && (
        <Card className="shadow-sm border-yellow-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-700">
              <Clock className="h-4 w-4" />
              Trials Expiring Soon ({trialsExpiring.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trialsExpiring.map((t) => (
                <Link key={t.id} href={`/tenants/${t.id}`}>
                  <a className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/60 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.ownerEmail}</p>
                    </div>
                    <div className="text-right">
                      <PlanBadge plan={t.plan} />
                      {t.trialEndsAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires {format(new Date(t.trialEndsAt), "MMM d")}
                        </p>
                      )}
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Signups</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No tenants yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentSignups.map((t) => (
                <Link key={t.id} href={`/tenants/${t.id}`}>
                  <a className="flex items-center justify-between py-3 hover:bg-muted/40 px-2 -mx-2 rounded transition-colors cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.ownerEmail}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <PlanBadge plan={t.plan} />
                      <StatusBadge status={t.status} />
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
