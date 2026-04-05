import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const ACTION_LABELS: Record<string, string> = {
  "admin.login":           "Login",
  "admin.logout":          "Logout",
  "admin.create":          "Admin Created",
  "admin.deactivate":      "Admin Deactivated",
  "admin.reset_password":  "Password Reset",
  "admin.change_password": "Password Changed",
  "tenant.suspend":        "Tenant Suspended",
  "tenant.reactivate":     "Tenant Reactivated",
  "tenant.change_plan":    "Plan Changed",
  "tenant.extend_trial":   "Trial Extended",
};

function ActionBadge({ action }: { action: string }) {
  const isTenant = action.startsWith("tenant.");
  const isAdmin  = action.startsWith("admin.");
  const cls = isTenant
    ? "bg-blue-100 text-blue-800"
    : isAdmin
    ? "bg-indigo-100 text-indigo-800"
    : "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

function MetaCell({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata || Object.keys(metadata).length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-xs font-mono text-muted-foreground break-all">
      {Object.entries(metadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")}
    </span>
  );
}

export default function AuditLogs() {
  const { data: me } = useMe();
  const { data: admins } = useQuery({ queryKey: ["admins"], queryFn: api.admins });

  const [filters, setFilters] = useState({
    adminId: "",
    action: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);

  function buildParams() {
    const p: Record<string, string> = { page: String(page) };
    if (filters.adminId) p.adminId = filters.adminId;
    if (filters.action)  p.action  = filters.action;
    if (filters.from)    p.from    = new Date(filters.from).toISOString();
    if (filters.to) {
      const d = new Date(filters.to);
      d.setDate(d.getDate() + 1); // inclusive end
      p.to = d.toISOString();
    }
    return p;
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-logs", filters, page],
    queryFn: () => api.auditLogs(buildParams()),
  });

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function clearFilters() {
    setFilters({ adminId: "", action: "", from: "", to: "" });
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Record of all admin actions</p>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="flex flex-wrap gap-3 items-end">
        {me?.role === "owner" && (
          <div className="w-48">
            <Select
              value={filters.adminId}
              onValueChange={(v) => setFilters({ ...filters, adminId: v === "all" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All admins" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All admins</SelectItem>
                {admins?.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Input
          className="w-44"
          placeholder="Filter by action…"
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
        />
        <Input
          className="w-40"
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          title="From date"
        />
        <Input
          className="w-40"
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          title="To date"
        />
        <Button type="submit" size="sm">Apply</Button>
        {(filters.adminId || filters.action || filters.from || filters.to) && (
          <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>
        )}
      </form>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="px-6 py-3 flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Failed to load audit logs.</p>
            </div>
          ) : !data || data.logs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No audit log entries found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Admin</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Target</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3">
                      {log.adminEmail ? (
                        <>
                          <p className="font-medium text-xs">{log.adminName}</p>
                          <p className="text-xs text-muted-foreground">{log.adminEmail}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {log.targetType && log.targetId
                        ? `${log.targetType} #${log.targetId}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                      <MetaCell metadata={log.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data.total} total entries</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
