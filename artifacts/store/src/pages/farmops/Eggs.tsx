import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Settings, Loader2, Check, X, Pencil } from "lucide-react";
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

const btnSecondary =
  "px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EggType {
  id: number;
  name: string;
  flockId: number | null;
  active: boolean;
}

interface OnHandItem {
  eggTypeId: number;
  eggTypeName: string;
  onHandEach: number;
}

interface Collection {
  id: number;
  eggTypeId: number;
  collectionDate: string;
  countEach: number;
  notes: string | null;
}

interface Adjustment {
  id: number;
  eggTypeId: number;
  lotId: number | null;
  qtyEach: number;
  reason: string;
  createdAt: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

const Q_EGG_TYPES = ["farmops", "eggTypes"] as const;
const Q_ON_HAND = ["farmops", "eggOnHand"] as const;
const Q_COLLECTION = ["farmops", "eggCollection"] as const;
const Q_ADJUSTMENTS = ["farmops", "eggAdjustments"] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

const TODAY = format(new Date(), "yyyy-MM-dd");

const BLANK_COLLECTION = {
  eggTypeId: "",
  collectionDate: TODAY,
  countEach: "",
  notes: "",
};

const BLANK_ADJUSTMENT = {
  eggTypeId: "",
  qtyEach: "",
  reason: "",
};

export default function FarmOpsEggs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();

  useEffect(() => {
    if (!sessionLoading && !session) setLocation("/farmops/login");
  }, [session, sessionLoading, setLocation]);

  // ── Egg type form ──
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  // ── Collection form ──
  const [collectionForm, setCollectionForm] = useState({ ...BLANK_COLLECTION });

  // ── Adjustment form ──
  const [adjForm, setAdjForm] = useState({ ...BLANK_ADJUSTMENT });

  // ── Inline adjustment edit ──
  const [editingAdjId, setEditingAdjId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editReason, setEditReason] = useState("");
  const editQtyRef = useRef<HTMLInputElement>(null);

  // ── Queries ──
  const { data: eggTypes = [] } = useQuery<EggType[]>({
    queryKey: Q_EGG_TYPES,
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch("/api/farmops/egg-types", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load egg types");
      return res.json();
    },
  });

  const { data: onHand = [], isLoading: onHandLoading } = useQuery<OnHandItem[]>({
    queryKey: Q_ON_HAND,
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch("/api/farmops/egg-inventory/on-hand", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load on-hand");
      return res.json();
    },
  });

  const { data: collections = [], isLoading: collectionsLoading } = useQuery<Collection[]>({
    queryKey: Q_COLLECTION,
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch("/api/farmops/egg-collection", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load collections");
      return res.json();
    },
  });

  const { data: adjustments = [], isLoading: adjustmentsLoading } = useQuery<Adjustment[]>({
    queryKey: Q_ADJUSTMENTS,
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch("/api/farmops/egg-adjustments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load adjustments");
      return res.json();
    },
  });

  // ── Helper: invalidate everything ──
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: Q_EGG_TYPES });
    qc.invalidateQueries({ queryKey: Q_ON_HAND });
    qc.invalidateQueries({ queryKey: Q_COLLECTION });
    qc.invalidateQueries({ queryKey: Q_ADJUSTMENTS });
  };

  // ── Lookup helper ──
  const eggTypeName = (id: number) =>
    eggTypes.find((t) => t.id === id)?.name ?? "—";

  // ── Mutations ──
  const createType = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/farmops/egg-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Egg type added" });
      setNewTypeName("");
      setShowTypeForm(false);
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createCollection = useMutation({
    mutationFn: async (data: typeof collectionForm) => {
      const res = await fetch("/api/farmops/egg-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eggTypeId: Number(data.eggTypeId),
          collectionDate: data.collectionDate,
          countEach: Number(data.countEach),
          notes: data.notes || null,
        }),
      });
      if (res.status === 409) {
        throw new Error("A collection for this egg type and date already exists.");
      }
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Collection recorded" });
      setCollectionForm({ ...BLANK_COLLECTION, collectionDate: format(new Date(), "yyyy-MM-dd") });
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createAdjustment = useMutation({
    mutationFn: async (data: typeof adjForm) => {
      const res = await fetch("/api/farmops/egg-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eggTypeId: Number(data.eggTypeId),
          qtyEach: Number(data.qtyEach),
          reason: data.reason,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Adjustment saved" });
      setAdjForm({ ...BLANK_ADJUSTMENT });
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateAdjustment = useMutation({
    mutationFn: async ({ id, qtyEach, reason }: { id: number; qtyEach: number; reason: string }) => {
      const res = await fetch(`/api/farmops/egg-adjustments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qtyEach, reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Adjustment updated" });
      setEditingAdjId(null);
      invalidateAll();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Edit adjustment handlers ──
  const startEditAdj = (adj: Adjustment) => {
    setEditingAdjId(adj.id);
    setEditQty(String(adj.qtyEach));
    setEditReason(adj.reason);
    // Focus input after state update
    setTimeout(() => editQtyRef.current?.focus(), 50);
  };

  const saveEditAdj = () => {
    if (editingAdjId == null || !editReason.trim() || editQty === "") return;
    updateAdjustment.mutate({
      id: editingAdjId,
      qtyEach: Number(editQty),
      reason: editReason,
    });
  };

  const cancelEditAdj = () => {
    setEditingAdjId(null);
    setEditQty("");
    setEditReason("");
  };

  // ── Sorted collections/adjustments (newest first) ──
  const sortedCollections = [...collections].reverse();
  const sortedAdjustments = [...adjustments].reverse();

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Egg Inventory</h1>
        <p className="text-slate-500 text-sm mt-1">
          Track daily egg collection and manage inventory.
        </p>
      </div>

      {/* ── Egg Types ────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            Egg Types
          </h2>
          <button
            onClick={() => setShowTypeForm((v) => !v)}
            className="px-3 py-1.5 rounded-md bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
          >
            + Add Type
          </button>
        </div>

        {showTypeForm && (
          <div className="flex gap-2 items-center">
            <input
              placeholder="e.g. Chicken Eggs, Duck Eggs…"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTypeName.trim()) createType.mutate(newTypeName.trim());
              }}
              className={inputCls + " flex-1"}
              autoFocus
            />
            <button
              onClick={() => {
                if (newTypeName.trim()) createType.mutate(newTypeName.trim());
              }}
              disabled={!newTypeName.trim() || createType.isPending}
              className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {createType.isPending ? "…" : "Add"}
            </button>
            <button
              onClick={() => {
                setShowTypeForm(false);
                setNewTypeName("");
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {eggTypes.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            No egg types yet. Add one to start recording collections.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {eggTypes.map((t) => (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  t.active
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {t.name}
                {!t.active && (
                  <span className="text-xs font-normal ml-1">(inactive)</span>
                )}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── On Hand ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">On Hand</h2>
        {onHandLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : onHand.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            No inventory data yet. Record a collection to populate this.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {onHand.map((item) => (
              <div
                key={item.eggTypeId}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-center"
              >
                <p className="text-xs text-slate-500 mb-1">{item.eggTypeName}</p>
                <p className="text-3xl font-bold text-slate-900">{item.onHandEach}</p>
                <p className="text-xs text-slate-400 mt-0.5">eggs</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Record Daily Collection ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Record Daily Collection</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Egg type</label>
            <select
              value={collectionForm.eggTypeId}
              onChange={(e) =>
                setCollectionForm((f) => ({ ...f, eggTypeId: e.target.value }))
              }
              className={selectCls}
            >
              <option value="">Egg type…</option>
              {eggTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Collection date</label>
            <input
              type="date"
              value={collectionForm.collectionDate}
              onChange={(e) =>
                setCollectionForm((f) => ({ ...f, collectionDate: e.target.value }))
              }
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Count</label>
            <input
              type="number"
              min={1}
              placeholder="Count (eggs)…"
              value={collectionForm.countEach}
              onChange={(e) =>
                setCollectionForm((f) => ({ ...f, countEach: e.target.value }))
              }
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Notes</label>
            <input
              placeholder="Notes (optional)…"
              value={collectionForm.notes}
              onChange={(e) =>
                setCollectionForm((f) => ({ ...f, notes: e.target.value }))
              }
              className={inputCls}
            />
          </div>
        </div>
        <button
          onClick={() => createCollection.mutate(collectionForm)}
          disabled={
            !collectionForm.eggTypeId ||
            !collectionForm.collectionDate ||
            !collectionForm.countEach ||
            createCollection.isPending
          }
          className={btnPrimary}
        >
          {createCollection.isPending ? "Saving…" : "Record Collection"}
        </button>
      </section>

      {/* ── Collection History ────────────────────────────────────────────── */}
      {!collectionsLoading && sortedCollections.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-800">Collection History</h2>
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Date", "Egg Type", "Count", "Notes"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2.5 text-xs font-medium text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedCollections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{c.collectionDate}</td>
                      <td className="px-4 py-3 text-slate-700">{eggTypeName(c.eggTypeId)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{c.countEach}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{c.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Record Adjustment ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Record Adjustment</h2>
        <p className="text-xs text-slate-500">
          Use positive numbers to add eggs (e.g. donation received) and negative numbers to
          subtract (e.g. breakage, personal use).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Egg type</label>
            <select
              value={adjForm.eggTypeId}
              onChange={(e) => setAdjForm((f) => ({ ...f, eggTypeId: e.target.value }))}
              className={selectCls}
            >
              <option value="">Egg type…</option>
              {eggTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Qty</label>
            <input
              type="number"
              placeholder="Qty (e.g. -5)…"
              value={adjForm.qtyEach}
              onChange={(e) => setAdjForm((f) => ({ ...f, qtyEach: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Reason (required)</label>
            <textarea
              rows={1}
              placeholder="Reason (required)…"
              value={adjForm.reason}
              onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))}
              className={inputCls + " resize-none"}
            />
          </div>
        </div>
        <button
          onClick={() => createAdjustment.mutate(adjForm)}
          disabled={
            !adjForm.eggTypeId ||
            adjForm.qtyEach === "" ||
            !adjForm.reason.trim() ||
            createAdjustment.isPending
          }
          className={btnPrimary}
        >
          {createAdjustment.isPending ? "Saving…" : "Save Adjustment"}
        </button>
      </section>

      {/* ── Adjustment Log ────────────────────────────────────────────────── */}
      {!adjustmentsLoading && sortedAdjustments.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Adjustment Log</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click the pencil icon on any row to correct the quantity or reason.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Date", "Egg Type", "Qty", "Reason", ""].map((h, i) => (
                      <th
                        key={i}
                        className="text-left px-4 py-2.5 text-xs font-medium text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedAdjustments.map((adj) => {
                    const isEditing = editingAdjId === adj.id;
                    return (
                      <tr
                        key={adj.id}
                        className={`group ${isEditing ? "bg-amber-50" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {adj.createdAt.slice(0, 10)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {eggTypeName(adj.eggTypeId)}
                        </td>
                        <td className="px-4 py-3 font-medium w-24">
                          {isEditing ? (
                            <input
                              ref={editQtyRef}
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditAdj();
                                if (e.key === "Escape") cancelEditAdj();
                              }}
                              className="w-24 px-2 py-1 rounded border border-slate-300 text-sm text-right focus:outline-none focus:border-emerald-500"
                            />
                          ) : (
                            <span
                              className={
                                adj.qtyEach < 0 ? "text-red-600" : "text-green-700"
                              }
                            >
                              {adj.qtyEach > 0 ? `+${adj.qtyEach}` : adj.qtyEach}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditAdj();
                                if (e.key === "Escape") cancelEditAdj();
                              }}
                              className="w-full px-2 py-1 rounded border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                            />
                          ) : (
                            adj.reason
                          )}
                        </td>
                        <td className="px-4 py-3 w-16">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={saveEditAdj}
                                disabled={
                                  !editReason.trim() ||
                                  editQty === "" ||
                                  updateAdjustment.isPending
                                }
                                className="h-7 w-7 flex items-center justify-center rounded text-green-600 hover:bg-green-100 disabled:opacity-40 transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEditAdj}
                                className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditAdj(adj)}
                              className="h-7 w-7 flex items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
