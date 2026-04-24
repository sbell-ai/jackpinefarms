import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
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

const BLANK_FORM = {
  slug: "", name: "", ownerEmail: "",
  plan: "starter" as "starter" | "growth" | "pro",
  status: "trialing" as "trialing" | "active" | "past_due" | "canceled" | "paused",
  trialEndsAt: "",
};

export default function Tenants() {
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useMe();
  const isOwner = me?.role === "owner";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [plan, setPlan] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const params: Record<string, string> = { page: String(page) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (status && status !== "all") params.status = status;
  if (plan && plan !== "all") params.plan = plan;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tenants", params],
    queryFn: () => api.tenants(params),
  });

  const createTenant = useMutation({
    mutationFn: () =>
      api.createTenant({
        ...form,
        trialEndsAt: form.trialEndsAt || undefined,
      }),
    onSuccess: (tenant) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setShowCreate(false);
      setForm(BLANK_FORM);
      setLocation(`/tenants/${tenant.id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `${data.total} total tenants` : "Manage all farm tenants"}
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => { setForm(BLANK_FORM); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Button>
        )}
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
                    <tr
                      key={t.id}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/tenants/${t.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{t.name}</p>
                          {t.createdByAdminId != null && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200 whitespace-nowrap">
                              Admin created
                            </span>
                          )}
                        </div>
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Tenant</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createTenant.mutate(); }}
            className="space-y-4 py-2"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ct-name">Name</Label>
                <Input
                  id="ct-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Sunny Acres Farm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ct-slug">Slug</Label>
                <Input
                  id="ct-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  placeholder="sunny-acres-farm"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-email">Owner Email</Label>
              <Input
                id="ct-email"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                placeholder="owner@example.com"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v as typeof form.plan })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter ($29/mo)</SelectItem>
                    <SelectItem value="growth">Growth ($79/mo)</SelectItem>
                    <SelectItem value="pro">Pro ($149/mo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.status === "trialing" && (
              <div className="space-y-2">
                <Label htmlFor="ct-trial">Trial End Date <span className="text-muted-foreground">(defaults to +14 days)</span></Label>
                <Input
                  id="ct-trial"
                  type="date"
                  value={form.trialEndsAt}
                  onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })}
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending ? "Creating..." : "Create Tenant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
