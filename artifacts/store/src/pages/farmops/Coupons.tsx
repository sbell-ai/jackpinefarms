import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Tag, Plus, X, Loader2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";

// ─── Constants ─────────────────────────────────────────────────────────────────

const inputCls =
  "px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Coupon {
  id: number;
  tenantId: number | null;
  code: string;
  description: string | null;
  discountType: "percent" | "amount";
  discountValue: number;
  maxRedemptions: number | null;
  redemptionsCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
  createdAt: string;
}

interface CouponForm {
  code: string;
  description: string;
  discountType: "percent" | "amount";
  discountValue: string;
  maxRedemptions: string;
  startsAt: string;
  endsAt: string;
}

const emptyForm: CouponForm = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDiscount(c: Coupon): string {
  if (c.discountType === "percent") return `${c.discountValue}% off`;
  return `$${(c.discountValue / 100).toFixed(2)} off`;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FarmOpsCoupons() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) {
      setLocation("/farmops/login");
    }
  }, [session, sessionLoading, setLocation]);

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["farmops-coupons"],
    queryFn: async () => {
      const res = await fetch("/api/farmops/coupons", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load coupons");
      return res.json();
    },
  });

  const isAdmin = session?.user.role === "owner" || session?.user.role === "admin";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discountValue: form.discountType === "percent"
          ? parseInt(form.discountValue)
          : Math.round(parseFloat(form.discountValue) * 100),
      };
      if (form.maxRedemptions) body.maxRedemptions = parseInt(form.maxRedemptions);
      if (form.startsAt) body.startsAt = new Date(form.startsAt).toISOString();
      if (form.endsAt) body.endsAt = new Date(form.endsAt).toISOString();

      const res = await fetch("/api/farmops/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create coupon");
      }
      queryClient.invalidateQueries({ queryKey: ["farmops-coupons"] });
      setShowForm(false);
      setForm(emptyForm);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/farmops/coupons/${id}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? "Failed to toggle coupon");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["farmops-coupons"] });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/farmops/coupons/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? "Failed to delete coupon");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["farmops-coupons"] });
    } finally {
      setDeletingId(null);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coupons</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage discount codes for your storefront</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add Coupon"}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-5">New Coupon</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Code + Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Coupon Code *</label>
                <input
                  className={`${inputCls} w-full font-mono uppercase`}
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  required
                  placeholder="SUMMER20"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <input
                  className={`${inputCls} w-full`}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="20% off summer orders"
                  maxLength={200}
                />
              </div>
            </div>

            {/* Discount Type + Value */}
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Discount Type *</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="discountType"
                      value="percent"
                      checked={form.discountType === "percent"}
                      onChange={() => setForm((f) => ({ ...f, discountType: "percent", discountValue: "" }))}
                    />
                    Percent off
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="discountType"
                      value="amount"
                      checked={form.discountType === "amount"}
                      onChange={() => setForm((f) => ({ ...f, discountType: "amount", discountValue: "" }))}
                    />
                    Fixed amount
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {form.discountType === "percent" ? "Percent (1–100) *" : "Amount ($) *"}
                </label>
                <input
                  className={`${inputCls} w-28`}
                  type="number"
                  min={form.discountType === "percent" ? 1 : 0.01}
                  max={form.discountType === "percent" ? 100 : undefined}
                  step={form.discountType === "percent" ? 1 : 0.01}
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                  required
                  placeholder={form.discountType === "percent" ? "20" : "5.00"}
                />
              </div>
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Max Redemptions</label>
                <input
                  className={`${inputCls} w-full`}
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxRedemptions}
                  onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Starts At</label>
                <input
                  type="datetime-local"
                  className={`${inputCls} w-full`}
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expires At</label>
                <input
                  type="datetime-local"
                  className={`${inputCls} w-full`}
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Create Coupon"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null); setForm(emptyForm); }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Coupon list */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-16 text-center">
            <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No coupons yet.</p>
            {isAdmin && <p className="text-sm text-slate-400 mt-1">Click "Add Coupon" to create your first discount code.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Discount</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Uses</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Expires</th>
                  {isAdmin && <th className="text-center px-4 py-3 font-semibold text-slate-600">Active</th>}
                  {isAdmin && <th className="px-4 py-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-mono font-bold text-slate-900">{c.code}</div>
                      {c.description && (
                        <div className="text-xs text-slate-400 mt-0.5">{c.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{formatDiscount(c)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {c.redemptionsCount}
                      {c.maxRedemptions != null && <span className="text-slate-400"> / {c.maxRedemptions}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.endsAt ? format(new Date(c.endsAt), "MMM d, yyyy") : <span className="text-slate-300">—</span>}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(c.id)}
                          disabled={togglingId === c.id}
                          className="inline-flex items-center justify-center transition-colors"
                          title={c.isActive ? "Deactivate coupon" : "Activate coupon"}
                        >
                          {togglingId === c.id ? (
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                          ) : c.isActive ? (
                            <ToggleRight className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                          )}
                        </button>
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {confirmDeleteId === c.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(c.id)}
                              disabled={deletingId === c.id}
                              className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingId === c.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Yes"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={c.redemptionsCount > 0 || deletingId === c.id}
                            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={c.redemptionsCount > 0 ? "Cannot delete: coupon has been used" : "Delete coupon"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
              {coupons.length} coupon{coupons.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
