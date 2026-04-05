import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ArrowLeft, Plus, Users } from "lucide-react";
import { format } from "date-fns";

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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2.5 border-b border-border last:border-0">
      <dt className="text-xs text-muted-foreground uppercase tracking-wide w-36 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const tenantId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useMe();
  const isOwner = me?.role === "owner";

  const [showSuspend, setShowSuspend] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showExtendTrial, setShowExtendTrial] = useState(false);
  const [newPlan, setNewPlan] = useState<"starter" | "growth" | "pro">("starter");
  const [newTrialDate, setNewTrialDate] = useState("");
  const [showAddAddon, setShowAddAddon] = useState(false);
  const [addonType, setAddonType] = useState<string>("");
  const [addonQty, setAddonQty] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => api.tenant(tenantId),
    enabled: !isNaN(tenantId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["tenants"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const suspend = useMutation({
    mutationFn: () => api.suspendTenant(tenantId),
    onSuccess: () => { toast({ title: "Tenant suspended" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reactivate = useMutation({
    mutationFn: () => api.reactivateTenant(tenantId),
    onSuccess: () => { toast({ title: "Tenant reactivated" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changePlan = useMutation({
    mutationFn: () => api.changePlan(tenantId, newPlan),
    onSuccess: () => {
      toast({ title: "Plan updated" });
      setShowChangePlan(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const extendTrial = useMutation({
    mutationFn: () => api.extendTrial(tenantId, newTrialDate),
    onSuccess: () => {
      toast({ title: "Trial extended" });
      setShowExtendTrial(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addAddon = useMutation({
    mutationFn: () => api.addAddon(tenantId, addonType, addonQty),
    onSuccess: () => {
      toast({ title: "Add-on saved" });
      setShowAddAddon(false);
      setAddonType("");
      setAddonQty(1);
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeAddon = useMutation({
    mutationFn: (type: string) => api.removeAddon(tenantId, type),
    onSuccess: () => {
      toast({ title: "Add-on removed" });
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isNaN(tenantId)) {
    return (
      <div className="p-8">
        <p className="text-destructive">Invalid tenant ID.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>Tenant not found.</p>
        </div>
      </div>
    );
  }

  const { tenant, users, addons, usage } = data;
  const isSuspended = tenant.status === "paused";

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tenants">
          <a className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </a>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{tenant.slug}</p>
        </div>
        <div className="ml-2 flex gap-2">
          <StatusBadge status={tenant.status} />
          <PlanBadge plan={tenant.plan} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tenant Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="Name">{tenant.name}</InfoRow>
                <InfoRow label="Slug"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tenant.slug}</code></InfoRow>
                <InfoRow label="Owner">{tenant.ownerEmail}</InfoRow>
                <InfoRow label="Status"><StatusBadge status={tenant.status} /></InfoRow>
                <InfoRow label="Plan"><PlanBadge plan={tenant.plan} /></InfoRow>
                {tenant.trialEndsAt && (
                  <InfoRow label="Trial Ends">
                    {format(new Date(tenant.trialEndsAt), "PPP")}
                  </InfoRow>
                )}
                {tenant.currentPeriodEndsAt && (
                  <InfoRow label="Period Ends">
                    {format(new Date(tenant.currentPeriodEndsAt), "PPP")}
                  </InfoRow>
                )}
                {tenant.stripeCustomerId && (
                  <InfoRow label="Stripe Customer">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tenant.stripeCustomerId}</code>
                  </InfoRow>
                )}
                <InfoRow label="Created">{format(new Date(tenant.createdAt), "PPP")}</InfoRow>
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users ({usage.userCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {users.length === 0 ? (
                <p className="px-6 py-6 text-sm text-muted-foreground text-center">No users yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-6 py-2.5 text-xs font-medium text-muted-foreground uppercase">Name</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Role</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase hidden sm:table-cell">Verified</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Last Login</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="px-6 py-3">
                            <p className="font-medium">{u.name || "-"}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </td>
                          <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{u.role}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={u.emailVerified ? "text-green-600 text-xs" : "text-yellow-600 text-xs"}>
                              {u.emailVerified ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                            {u.lastLoginAt ? format(new Date(u.lastLoginAt), "MMM d, yyyy") : "Never"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Add-ons</CardTitle>
              {isOwner && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setAddonType(""); setAddonQty(1); setShowAddAddon(true); }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Add-on
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {addons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No add-ons active.</p>
              ) : (
                <div className="space-y-1">
                  {addons.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium capitalize">{a.addonType.replace(/_/g, " ")}</span>
                        {a.addonType === "extra_admin_users" && (
                          <span className="ml-2 text-muted-foreground text-xs">×{a.quantity}</span>
                        )}
                      </div>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7 px-2"
                          disabled={removeAddon.isPending}
                          onClick={() => {
                            if (confirm(`Remove "${a.addonType.replace(/_/g, " ")}" add-on?`)) {
                              removeAddon.mutate(a.addonType);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {isOwner && (
          <div className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isSuspended ? (
                  <Button
                    variant="outline"
                    className="w-full text-green-700 border-green-200 hover:bg-green-50"
                    disabled={reactivate.isPending}
                    onClick={() => setShowReactivate(true)}
                  >
                    Reactivate Tenant
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                    disabled={suspend.isPending}
                    onClick={() => setShowSuspend(true)}
                  >
                    Suspend Tenant
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setNewPlan(tenant.plan as "starter" | "growth" | "pro");
                    setShowChangePlan(true);
                  }}
                >
                  Change Plan
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setNewTrialDate(
                      tenant.trialEndsAt
                        ? format(new Date(tenant.trialEndsAt), "yyyy-MM-dd")
                        : format(new Date(), "yyyy-MM-dd")
                    );
                    setShowExtendTrial(true);
                  }}
                >
                  Extend Trial
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Users</span>
                  <span className="font-medium">{usage.userCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invitations</span>
                  <span className="font-medium">{usage.inviteCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showSuspend} onOpenChange={setShowSuspend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Tenant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to suspend <strong>{data?.tenant.name}</strong>? This will pause their access immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspend(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { setShowSuspend(false); suspend.mutate(); }}
              disabled={suspend.isPending}
            >
              {suspend.isPending ? "Suspending..." : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReactivate} onOpenChange={setShowReactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivate Tenant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Reactivate <strong>{data?.tenant.name}</strong>? Their access will be restored.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReactivate(false)}>Cancel</Button>
            <Button
              onClick={() => { setShowReactivate(false); reactivate.mutate(); }}
              disabled={reactivate.isPending}
            >
              {reactivate.isPending ? "Reactivating..." : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label>New Plan</Label>
            <Select value={newPlan} onValueChange={(v) => setNewPlan(v as "starter" | "growth" | "pro")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter ($29/mo)</SelectItem>
                <SelectItem value="growth">Growth ($79/mo)</SelectItem>
                <SelectItem value="pro">Pro ($149/mo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePlan(false)}>Cancel</Button>
            <Button onClick={() => changePlan.mutate()} disabled={changePlan.isPending}>
              {changePlan.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExtendTrial} onOpenChange={setShowExtendTrial}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Trial</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label htmlFor="trial-date">New trial end date</Label>
            <Input
              id="trial-date"
              type="date"
              value={newTrialDate}
              onChange={(e) => setNewTrialDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtendTrial(false)}>Cancel</Button>
            <Button
              onClick={() => extendTrial.mutate()}
              disabled={extendTrial.isPending || !newTrialDate}
            >
              {extendTrial.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAddon} onOpenChange={setShowAddAddon}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Add-on</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Add-on Type</Label>
              <Select value={addonType} onValueChange={setAddonType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an add-on…" />
                </SelectTrigger>
                <SelectContent>
                  {(["custom_domain", "sms_notifications", "extra_admin_users", "white_label"] as const)
                    .filter((t) => !addons.some((a) => a.addonType === t))
                    .map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {addonType === "extra_admin_users" && (
              <div className="space-y-2">
                <Label htmlFor="addon-qty">Quantity</Label>
                <Input
                  id="addon-qty"
                  type="number"
                  min={1}
                  value={addonQty}
                  onChange={(e) => setAddonQty(Math.max(1, Number(e.target.value)))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAddon(false)}>Cancel</Button>
            <Button onClick={() => addAddon.mutate()} disabled={addAddon.isPending || !addonType}>
              {addAddon.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
