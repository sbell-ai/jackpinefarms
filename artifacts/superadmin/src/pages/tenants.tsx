import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

export default function Tenants() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [plan, setPlan] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const params: Record<string, string> = { page: String(page) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (status && status !== "all") params.status = status;
  if (plan && plan !== "all") params.plan = plan;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tenants", params],
    queryFn: () => api.tenants(params),
  });

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    clearTimeout((window as Window & { _searchTimeout?: ReturnType<typeof setTimeout> })._searchTimeout);
    (window as Window & { _searchTimeout?: ReturnType<typeof setTimeout> })._searchTimeout = setTimeout(() => {
      setDebouncedSearch(val);
    }, 300);
  }

  function handleStatusChange(val: string) {
    setStatus(val);
    setPage(1);
  }

  function handlePlanChange(val: string) {
    setPlan(val);
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tenants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data ? `${data.total} total tenants` : "Manage all farm tenants"}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, email or slug..."
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={plan} onValueChange={handlePlanChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Failed to load tenants.</p>
            </div>
          ) : !data || data.tenants.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No tenants found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tenant</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Users</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.tenants.map((t) => (
                    <Link key={t.id} href={`/tenants/${t.id}`}>
                      <tr className="hover:bg-muted/40 cursor-pointer transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.ownerEmail}</p>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-4">
                          <PlanBadge plan={t.plan} />
                        </td>
                        <td className="px-4 py-4 hidden md:table-cell text-muted-foreground">
                          {t.userCount ?? "-"}
                        </td>
                        <td className="px-4 py-4 hidden lg:table-cell text-muted-foreground text-xs">
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

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({data.total} results)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
