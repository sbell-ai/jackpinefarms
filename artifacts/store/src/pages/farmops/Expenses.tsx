import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { DollarSign, Plus, Pencil, Trash2, X, Check, TrendingDown, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";
import { useEffect } from "react";

const EXPENSE_CATEGORIES = [
  "feed", "supplies", "equipment", "utilities",
  "labor", "veterinary", "processing", "marketing", "other",
] as const;
type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  feed: "Feed",
  supplies: "Supplies",
  equipment: "Equipment",
  utilities: "Utilities",
  labor: "Labor",
  veterinary: "Veterinary",
  processing: "Processing",
  marketing: "Marketing",
  other: "Other",
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  feed: "bg-amber-100 text-amber-800",
  supplies: "bg-blue-100 text-blue-800",
  equipment: "bg-purple-100 text-purple-800",
  utilities: "bg-orange-100 text-orange-800",
  labor: "bg-green-100 text-green-800",
  veterinary: "bg-red-100 text-red-800",
  processing: "bg-indigo-100 text-indigo-800",
  marketing: "bg-pink-100 text-pink-800",
  other: "bg-gray-100 text-gray-700",
};

const PAYMENT_METHODS = ["cash", "check", "card", "transfer", "other"];

interface Expense {
  id: number;
  date: string;
  category: string;
  description: string;
  amountCents: number;
  vendor: string | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
}

interface Summary {
  byCategory: { category: string; totalCents: number; count: number }[];
  totalCents: number;
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const BLANK_FORM = {
  date: format(new Date(), "yyyy-MM-dd"),
  category: "feed" as ExpenseCategory,
  description: "",
  amountCents: "",
  vendor: "",
  paymentMethod: "card",
  notes: "",
};

export default function FarmOpsExpenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();

  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [filterCategory, setFilterCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [showSummary, setShowSummary] = useState(true);

  useEffect(() => {
    if (!sessionLoading && !session) {
      setLocation("/farmops/login");
    }
  }, [session, sessionLoading, setLocation]);

  const queryKey = ["farmops-expenses", fromDate, toDate, filterCategory];
  const summaryKey = ["farmops-expenses-summary", fromDate, toDate];

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey,
    enabled: !!session,
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`/api/farmops/expenses?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load expenses");
      return res.json();
    },
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: summaryKey,
    enabled: !!session,
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      const res = await fetch(`/api/farmops/expenses/summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["farmops-expenses"] });
    queryClient.invalidateQueries({ queryKey: ["farmops-expenses-summary"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/farmops/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          amountCents: Math.round(parseFloat(String(data.amountCents)) * 100),
          vendor: data.vendor || null,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setForm({ ...BLANK_FORM });
      toast({ title: "Expense recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await fetch(`/api/farmops/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          amountCents: Math.round(parseFloat(String(data.amountCents)) * 100),
          vendor: data.vendor || null,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm({ ...BLANK_FORM });
      toast({ title: "Expense updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/farmops/expenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Expense deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amountCents) return;
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const startEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      date: exp.date,
      category: (exp.category as ExpenseCategory) ?? "other",
      description: exp.description,
      amountCents: String((exp.amountCents / 100).toFixed(2)),
      vendor: exp.vendor ?? "",
      paymentMethod: exp.paymentMethod ?? "card",
      notes: exp.notes ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...BLANK_FORM });
  };

  const setQuickRange = (months: number) => {
    const d = new Date();
    if (months === 0) {
      setFromDate(format(startOfMonth(d), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(d), "yyyy-MM-dd"));
    } else {
      const start = subMonths(startOfMonth(d), months - 1);
      setFromDate(format(start, "yyyy-MM-dd"));
      setToDate(format(endOfMonth(d), "yyyy-MM-dd"));
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

  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track farm operating costs for {session.tenant.name}</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-bold rounded-lg hover:bg-emerald-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">
              {editingId !== null ? "Edit Expense" : "New Expense"}
            </h2>
            <button onClick={cancelForm} className="text-slate-400 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
              <input type="date" required value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
              <select required value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                className={inputCls}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <input type="text" required placeholder="e.g. 50 lbs layer pellets"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Amount ($)</label>
              <input type="number" required min="0" step="0.01" placeholder="0.00"
                value={form.amountCents}
                onChange={(e) => setForm({ ...form, amountCents: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
              <select value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className={inputCls}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Vendor <span className="font-normal">(optional)</span></label>
              <input type="text" placeholder="e.g. Tractor Supply"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes <span className="font-normal">(optional)</span></label>
              <input type="text" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputCls} />
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-700 text-white text-sm font-bold rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {editingId !== null ? "Save Changes" : "Save Expense"}
              </button>
              <button type="button" onClick={cancelForm}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500">
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {([["This month", 0], ["3 months", 3], ["6 months", 6], ["12 months", 12]] as [string, number][]).map(([label, n]) => (
              <button key={n} onClick={() => setQuickRange(n)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <span className="font-bold text-slate-900">
                Total: {formatMoney(summary.totalCents)}
              </span>
              <span className="text-sm text-slate-500">
                {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
              </span>
            </div>
            {showSummary ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showSummary && summary.byCategory.length > 0 && (
            <div className="px-6 pb-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
              {summary.byCategory.map((row) => (
                <div key={row.category} className="flex flex-col gap-1 p-3 rounded-xl bg-slate-50">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full w-fit ${CATEGORY_COLORS[row.category as ExpenseCategory] ?? "bg-gray-100 text-gray-700"}`}>
                    {CATEGORY_LABELS[row.category as ExpenseCategory] ?? row.category}
                  </span>
                  <span className="text-lg font-bold text-slate-900">{formatMoney(row.totalCents)}</span>
                  <span className="text-xs text-slate-500">{row.count} entr{row.count !== 1 ? "ies" : "y"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expense List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No expenses in this period</p>
            <p className="text-sm text-slate-400 mt-1">Click "Add Expense" to record your first one.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group">
                <div className="hidden sm:block text-sm text-slate-500 w-24 shrink-0">
                  {format(new Date(exp.date + "T12:00:00"), "MMM d, yyyy")}
                </div>
                <span className={`hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[exp.category as ExpenseCategory] ?? "bg-gray-100 text-gray-700"}`}>
                  {CATEGORY_LABELS[exp.category as ExpenseCategory] ?? exp.category}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{exp.description}</p>
                  <p className="text-xs text-slate-500 sm:hidden">
                    {format(new Date(exp.date + "T12:00:00"), "MMM d, yyyy")}
                    {" · "}
                    <span className={`inline text-xs font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category as ExpenseCategory] ?? "bg-gray-100 text-gray-700"}`}>
                      {CATEGORY_LABELS[exp.category as ExpenseCategory] ?? exp.category}
                    </span>
                  </p>
                  {(exp.vendor || exp.paymentMethod) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {exp.vendor && <span>{exp.vendor}</span>}
                      {exp.vendor && exp.paymentMethod && <span> · </span>}
                      {exp.paymentMethod && <span className="capitalize">{exp.paymentMethod}</span>}
                    </p>
                  )}
                  {exp.notes && <p className="text-xs text-slate-400 italic mt-0.5">{exp.notes}</p>}
                </div>
                <div className="font-bold text-slate-900 text-sm shrink-0 w-20 text-right">
                  {formatMoney(exp.amountCents)}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(exp)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this expense?")) deleteMutation.mutate(exp.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
