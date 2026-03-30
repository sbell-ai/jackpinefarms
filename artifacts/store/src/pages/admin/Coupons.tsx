import { useState } from "react";
import { Loader2, Plus, ToggleLeft, ToggleRight, Trash2, Tag, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminListCoupons,
  useAdminCreateCoupon,
  useAdminToggleCoupon,
  useAdminDeleteCoupon,
} from "@workspace/api-client-react";
import type { Coupon, CreateCouponBody } from "@workspace/api-client-react";

interface CreateForm {
  code: string;
  description: string;
  discountType: "percent" | "amount";
  discountValue: string;
  maxRedemptions: string;
  endsAt: string;
}

const emptyForm: CreateForm = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  maxRedemptions: "",
  endsAt: "",
};

export default function Coupons() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: coupons = [], isLoading, refetch } = useAdminListCoupons();

  const createMutation = useAdminCreateCoupon({
    mutation: {
      onSuccess: (coupon: Coupon) => {
        toast({ title: "Coupon created", description: `Code: ${coupon.code}` });
        setShowForm(false);
        setForm(emptyForm);
        refetch();
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to create coupon";
        setFormError(msg);
      },
    },
  });

  const toggleMutation = useAdminToggleCoupon({
    mutation: {
      onSuccess: () => { refetch(); },
    },
  });

  const deleteMutation = useAdminDeleteCoupon({
    mutation: {
      onSuccess: () => {
        toast({ title: "Coupon deleted" });
        refetch();
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Cannot delete coupon";
        toast({ title: "Cannot delete", description: msg, variant: "destructive" });
      },
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const discountValue = parseFloat(form.discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
      setFormError("Discount value must be a positive number");
      return;
    }
    if (form.discountType === "percent" && discountValue > 100) {
      setFormError("Percent discount cannot exceed 100%");
      return;
    }

    const body: CreateCouponBody = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: form.discountType === "percent"
        ? Math.round(discountValue)
        : Math.round(discountValue * 100),
    };
    if (form.description.trim()) body.description = form.description.trim();
    if (form.maxRedemptions) body.maxRedemptions = parseInt(form.maxRedemptions, 10);
    if (form.endsAt) body.endsAt = new Date(form.endsAt).toISOString();

    createMutation.mutate({ data: body });
  };

  const handleToggle = (id: number) => toggleMutation.mutate({ id });

  const handleDelete = (id: number) => {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    deleteMutation.mutate({ id });
  };

  const formatDiscount = (c: Coupon) =>
    c.discountType === "percent" ? `${c.discountValue}% off` : `${formatMoney(c.discountValue)} off`;

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-CA") : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Coupons</h1>
          <p className="text-muted-foreground mt-1">Create and manage discount codes for customers</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(null); setForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Coupon
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold">Create Coupon</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold">Coupon Code *</label>
              <input
                required
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. SUMMER20"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold">Description (optional)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Internal note"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold">Discount Type *</label>
              <select
                value={form.discountType}
                onChange={e => setForm(f => ({ ...f, discountType: e.target.value as "percent" | "amount", discountValue: "" }))}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                <option value="percent">Percentage (e.g. 10%)</option>
                <option value="amount">Fixed Amount (e.g. $5.00)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold">
                {form.discountType === "percent" ? "Discount % *" : "Discount Amount ($) *"}
              </label>
              <div className="relative">
                {form.discountType === "amount" && (
                  <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground">$</span>
                )}
                <input
                  required
                  type="number"
                  min="0.01"
                  step={form.discountType === "percent" ? "1" : "0.01"}
                  max={form.discountType === "percent" ? "100" : undefined}
                  value={form.discountValue}
                  onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                  placeholder={form.discountType === "percent" ? "10" : "5.00"}
                  className={`w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${form.discountType === "amount" ? "pl-7" : ""}`}
                />
                {form.discountType === "percent" && (
                  <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground">%</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold">Max Redemptions</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.maxRedemptions}
                onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                placeholder="Unlimited"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <p className="text-xs text-muted-foreground">Leave blank for unlimited uses</p>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-bold">Expiry Date (optional)</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {formError && (
              <div className="md:col-span-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {formError}
              </div>
            )}

            <div className="md:col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Coupon
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Tag className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No coupons yet</p>
            <p className="text-sm text-muted-foreground">Create your first discount code above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">Discount</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">Uses</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">Expires</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map(coupon => (
                  <tr key={coupon.id} className={`hover:bg-muted/20 transition-colors ${!coupon.isActive ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-bold tracking-wider">{coupon.code}</span>
                        {coupon.description && (
                          <span className="text-xs text-muted-foreground">{coupon.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{formatDiscount(coupon)}</td>
                    <td className="px-4 py-3">
                      {coupon.maxRedemptions != null
                        ? `${coupon.redemptionsCount} / ${coupon.maxRedemptions}`
                        : `${coupon.redemptionsCount} / ∞`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(coupon.endsAt) ?? "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const isExpired = coupon.endsAt ? new Date(coupon.endsAt) < new Date() : false;
                        const isMaxed = coupon.maxRedemptions != null && coupon.redemptionsCount >= coupon.maxRedemptions;
                        const label = isExpired ? "Expired" : isMaxed ? "Maxed out" : coupon.isActive ? "Active" : "Disabled";
                        const cls = coupon.isActive && !isExpired && !isMaxed
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : isExpired
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                            : "bg-muted text-muted-foreground";
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggle(coupon.id)}
                          disabled={toggleMutation.isPending && toggleMutation.variables?.id === coupon.id}
                          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                          title={coupon.isActive ? "Deactivate" : "Activate"}
                        >
                          {toggleMutation.isPending && toggleMutation.variables?.id === coupon.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : coupon.isActive
                              ? <ToggleRight className="w-4 h-4 text-green-600" />
                              : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          disabled={(deleteMutation.isPending && deleteMutation.variables?.id === coupon.id) || coupon.redemptionsCount > 0}
                          className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                          title={coupon.redemptionsCount > 0 ? "Cannot delete a used coupon" : "Delete coupon"}
                        >
                          {deleteMutation.isPending && deleteMutation.variables?.id === coupon.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
