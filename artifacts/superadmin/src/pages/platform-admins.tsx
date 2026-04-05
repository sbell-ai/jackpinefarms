import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Plus, Copy, Check } from "lucide-react";
import { format } from "date-fns";

export default function PlatformAdmins() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useMe();
  const isOwner = me?.role === "owner";

  const [showCreate, setShowCreate] = useState(false);
  const [showTempPw, setShowTempPw] = useState(false);
  const [tempPwMode, setTempPwMode] = useState<"created" | "reset">("created");
  const [tempPassword, setTempPassword] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [copiedPw, setCopiedPw] = useState(false);

  const [form, setForm] = useState<{ email: string; name: string; role: "owner" | "support" }>({
    email: "",
    name: "",
    role: "support",
  });

  const { data: admins, isLoading, isError } = useQuery({
    queryKey: ["admins"],
    queryFn: api.admins,
  });

  const createAdmin = useMutation({
    mutationFn: () => api.createAdmin(form),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setTempPassword(data.tempPassword);
      setNewAdminEmail(data.email);
      setTempPwMode("created");
      setShowCreate(false);
      setShowTempPw(true);
      setForm({ email: "", name: "", role: "support" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => api.deactivateAdmin(id),
    onSuccess: () => {
      toast({ title: "Admin deactivated" });
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetPassword = useMutation({
    mutationFn: (id: number) => api.resetAdminPassword(id),
    onSuccess: (data) => {
      setTempPassword(data.tempPassword);
      setNewAdminEmail(data.email);
      setTempPwMode("reset");
      setShowTempPw(true);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function copyTempPw() {
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopiedPw(true);
      setTimeout(() => setCopiedPw(false), 2000);
    });
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Platform Admins</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage super admin accounts</p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Admin
          </Button>
        )}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Failed to load admins.</p>
            </div>
          ) : !admins || admins.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No admins found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Admin</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Last Login</th>
                  {isOwner && (
                    <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {admins.map((a) => (
                  <tr key={a.id} className={!a.isActive ? "opacity-50" : ""}>
                    <td className="px-6 py-3">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        a.role === "owner"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {a.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        a.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}>
                        {a.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {a.lastLoginAt ? format(new Date(a.lastLoginAt), "MMM d, yyyy") : "Never"}
                    </td>
                    {isOwner && (
                      <td className="px-6 py-3 text-right space-x-1">
                        {a.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            disabled={resetPassword.isPending}
                            onClick={() => {
                              if (confirm(`Reset password for ${a.name}? A new temporary password will be generated.`)) {
                                resetPassword.mutate(a.id);
                              }
                            }}
                          >
                            Reset Password
                          </Button>
                        )}
                        {a.isActive && a.id !== me?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                            disabled={deactivate.isPending}
                            onClick={() => {
                              if (confirm(`Deactivate ${a.name}?`)) {
                                deactivate.mutate(a.id);
                              }
                            }}
                          >
                            Deactivate
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Platform Admin</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createAdmin.mutate(); }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="jane@jackpinefarms.farm"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as "owner" | "support" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Support (read-only actions)</SelectItem>
                  <SelectItem value="owner">Owner (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAdmin.isPending}>
                {createAdmin.isPending ? "Creating..." : "Create Admin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showTempPw} onOpenChange={(open) => { if (!open) setShowTempPw(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tempPwMode === "created" ? "Admin Created" : "Password Reset"}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {tempPwMode === "created"
                ? <>The account for <strong>{newAdminEmail}</strong> has been created. Share this temporary password securely. It will not be shown again.</>
                : <>The password for <strong>{newAdminEmail}</strong> has been reset. Share this temporary password securely. It will not be shown again.</>
              }
            </p>
            <div className="rounded-md bg-muted p-3 flex items-center gap-3">
              <code className="flex-1 text-sm font-mono break-all">{tempPassword}</code>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={copyTempPw}
              >
                {copiedPw ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
              The admin must change this password on their first login. Store it in a secure location before closing this dialog.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTempPw(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
