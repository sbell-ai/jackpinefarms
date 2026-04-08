import { useState, useEffect } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Users, UserPlus, Trash2, Mail, Loader2, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

const selectCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all appearance-none";

const btnPrimary =
  "px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const btnDanger =
  "p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: number;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Invitation {
  id: number;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
  createdAt: string;
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  member: "bg-gray-100 text-gray-600",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-600"}`}>
      {role}
    </span>
  );
}

// ─── Query keys ───────────────────────────────────────────────────────────────

const Q_MEMBERS = ["farmops", "team", "members"] as const;
const Q_INVITATIONS = ["farmops", "team", "invitations"] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FarmOpsTeam() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();

  useEffect(() => {
    if (!sessionLoading && !session) setLocation("/farmops/login");
  }, [session, sessionLoading, setLocation]);

  const currentUserId = session?.user?.id;
  const role = session?.user?.role as "owner" | "admin" | "member" | undefined;
  const canManage = role === "owner" || role === "admin";

  // ── Invite form state ──
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  // ── Remove confirm state ──
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  // ── Queries ──
  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: Q_MEMBERS,
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch("/api/farmops/team/members", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load team");
      return res.json();
    },
  });

  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: Q_INVITATIONS,
    enabled: !!session && canManage,
    queryFn: async () => {
      const res = await fetch("/api/farmops/team/invitations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invitations");
      return res.json();
    },
  });

  // ── Mutations ──
  const sendInvite = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "admin" | "member" }) => {
      const res = await fetch("/api/farmops/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to send invitation");
      return res.json();
    },
    onSuccess: (_, { email }) => {
      toast({ title: `Invitation sent to ${email}` });
      setInviteEmail("");
      setInviteRole("member");
      qc.invalidateQueries({ queryKey: Q_INVITATIONS });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/farmops/team/invitations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to cancel");
    },
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      qc.invalidateQueries({ queryKey: Q_INVITATIONS });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: "admin" | "member" }) => {
      const res = await fetch(`/api/farmops/team/members/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Role updated" });
      qc.invalidateQueries({ queryKey: Q_MEMBERS });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/farmops/team/members/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to remove member");
    },
    onSuccess: () => {
      toast({ title: "Member removed" });
      setConfirmRemoveId(null);
      qc.invalidateQueries({ queryKey: Q_MEMBERS });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setConfirmRemoveId(null);
    },
  });

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-emerald-600" />
          Team
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage who has access to your farm account.
        </p>
      </div>

      {/* ── Team Members ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800">
            Team Members
            {members.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-400">({members.length})</span>
            )}
          </h2>
        </div>

        {membersLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              const isOwner = member.role === "owner";
              const canEditThis = role === "owner" && !isSelf && !isOwner;

              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar placeholder */}
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm flex items-center justify-center shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                      {isSelf && (
                        <span className="text-xs text-slate-400">(you)</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                  </div>

                  {/* Role — select for owner editing, badge otherwise */}
                  <div className="shrink-0">
                    {canEditThis ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          changeRole.mutate({
                            id: member.id,
                            role: e.target.value as "admin" | "member",
                          })
                        }
                        disabled={changeRole.isPending}
                        className="px-2 py-1 rounded-md border border-slate-300 bg-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all appearance-none"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </div>

                  {/* Remove button (owner only, not self, not other owner) */}
                  <div className="shrink-0 w-8">
                    {canEditThis && (
                      confirmRemoveId === member.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeMember.mutate(member.id)}
                            disabled={removeMember.isPending}
                            className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveId(member.id)}
                          className={btnDanger}
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Invite Team Member (admin + owner only) ────────────────────────── */}
      {canManage && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-800">Invite Team Member</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Email address</label>
              <input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inviteEmail.trim()) {
                    sendInvite.mutate({ email: inviteEmail.trim(), role: inviteRole });
                  }
                }}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                className={selectCls}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={() => {
                if (inviteEmail.trim()) {
                  sendInvite.mutate({ email: inviteEmail.trim(), role: inviteRole });
                }
              }}
              disabled={!inviteEmail.trim() || sendInvite.isPending}
              className={btnPrimary}
            >
              {sendInvite.isPending ? "Sending…" : "Send Invite"}
            </button>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 space-y-0.5">
            <p><strong className="text-slate-700">Member</strong> — can view and record farm data</p>
            <p><strong className="text-slate-700">Admin</strong> — full access to farm data, can invite others</p>
          </div>
        </section>
      )}

      {/* ── Pending Invitations (admin + owner only) ──────────────────────── */}
      {canManage && invitations.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-800">
              Pending Invitations
              <span className="ml-2 text-xs font-normal text-slate-400">({invitations.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{inv.email}</p>
                  <p className="text-xs text-slate-400">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <RoleBadge role={inv.role} />
                <button
                  onClick={() => cancelInvite.mutate(inv.id)}
                  disabled={cancelInvite.isPending}
                  className={btnDanger}
                  title="Cancel invitation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
