import { useState } from "react";
import { format } from "date-fns";
import {
  useAdminGetEggInventoryOnHand,
  useAdminListEggTypes,
  useAdminCreateEggType,
  useAdminListEggCollection,
  useAdminCreateEggCollection,
  useAdminListEggAdjustments,
  useAdminCreateEggAdjustment,
  getAdminGetEggInventoryOnHandQueryKey,
  getAdminListEggTypesQueryKey,
  getAdminListEggCollectionQueryKey,
  getAdminListEggAdjustmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Egg, TrendingDown, Plus, Settings, Pencil, Check, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function AdminEggInventory() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: onHand = [], isLoading: onHandLoading } =
    useAdminGetEggInventoryOnHand({
      query: { queryKey: getAdminGetEggInventoryOnHandQueryKey() },
    });

  const { data: eggTypes = [] } = useAdminListEggTypes({
    query: { queryKey: getAdminListEggTypesQueryKey() },
  });

  const { data: collections = [] } = useAdminListEggCollection(
    {},
    { query: { queryKey: getAdminListEggCollectionQueryKey({}) } },
  );

  const { data: adjustments = [] } = useAdminListEggAdjustments(
    {},
    { query: { queryKey: getAdminListEggAdjustmentsQueryKey({}) } },
  );

  const [collForm, setCollForm] = useState({
    eggTypeId: "",
    collectionDate: format(new Date(), "yyyy-MM-dd"),
    countEach: "",
    notes: "",
  });

  const [adjForm, setAdjForm] = useState({
    eggTypeId: "",
    qtyEach: "",
    reason: "",
  });

  const [newEggTypeName, setNewEggTypeName] = useState("");
  const [showEggTypeForm, setShowEggTypeForm] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ qtyEach: "", reason: "" });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getAdminGetEggInventoryOnHandQueryKey() });
    qc.invalidateQueries({ queryKey: getAdminListEggTypesQueryKey() });
    qc.invalidateQueries({ queryKey: getAdminListEggCollectionQueryKey({}) });
    qc.invalidateQueries({ queryKey: getAdminListEggAdjustmentsQueryKey({}) });
  };

  const createEggType = useAdminCreateEggType({
    mutation: {
      onSuccess: () => {
        toast({ title: "Egg type added" });
        setNewEggTypeName("");
        setShowEggTypeForm(false);
        invalidateAll();
      },
      onError: (e: any) =>
        toast({
          title: "Error",
          description: e.response?.data?.error ?? e.message,
          variant: "destructive",
        }),
    },
  });

  const createCollection = useAdminCreateEggCollection({
    mutation: {
      onSuccess: () => {
        toast({ title: "Collection recorded" });
        setCollForm({
          eggTypeId: "",
          collectionDate: format(new Date(), "yyyy-MM-dd"),
          countEach: "",
          notes: "",
        });
        invalidateAll();
      },
      onError: (e: any) =>
        toast({
          title: "Error",
          description: e.message,
          variant: "destructive",
        }),
    },
  });

  const createAdjustment = useAdminCreateEggAdjustment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Adjustment saved" });
        setAdjForm({ eggTypeId: "", qtyEach: "", reason: "" });
        invalidateAll();
      },
      onError: (e: any) =>
        toast({
          title: "Error",
          description: e.message,
          variant: "destructive",
        }),
    },
  });

  const updateAdjustment = useMutation({
    mutationFn: async ({ id, qtyEach, reason }: { id: number; qtyEach: number; reason: string }) => {
      const res = await fetch(`/api/admin/egg-adjustments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyEach, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update adjustment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Adjustment updated" });
      setEditingId(null);
      invalidateAll();
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleRecordCollection = () => {
    if (!collForm.eggTypeId || !collForm.collectionDate || !collForm.countEach)
      return;
    createCollection.mutate({
      data: {
        eggTypeId: Number(collForm.eggTypeId),
        collectionDate: collForm.collectionDate,
        countEach: Number(collForm.countEach),
        notes: collForm.notes || undefined,
      } as any,
    });
  };

  const handleRecordAdjustment = () => {
    if (!adjForm.eggTypeId || !adjForm.qtyEach || !adjForm.reason.trim())
      return;
    createAdjustment.mutate({
      data: {
        eggTypeId: Number(adjForm.eggTypeId),
        qtyEach: Number(adjForm.qtyEach),
        reason: adjForm.reason.trim(),
      } as any,
    });
  };

  const handleStartEdit = (a: any) => {
    setEditingId(a.id);
    setEditForm({ qtyEach: String(a.qtyEach), reason: a.reason });
  };

  const handleSaveEdit = () => {
    if (editingId === null) return;
    const qty = Number(editForm.qtyEach);
    if (!Number.isInteger(qty) || !editForm.reason.trim()) return;
    updateAdjustment.mutate({ id: editingId, qtyEach: qty, reason: editForm.reason.trim() });
  };

  const eggTypeMap = new Map(
    (eggTypes as any[]).map((et: any) => [et.id, et.name]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Egg Inventory</h1>
        <p className="text-muted-foreground mt-1">
          Track egg collection, on-hand counts, and adjustments.
        </p>
      </div>

      {/* Egg Types Setup */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Settings className="w-3.5 h-3.5" /> Egg Types
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setShowEggTypeForm((v) => !v)}>
            <Plus className="w-4 h-4 mr-1" /> Add Type
          </Button>
        </div>

        {showEggTypeForm && (
          <div className="rounded-lg border border-border bg-card p-4 mb-3 space-y-3">
            <div className="text-sm font-semibold text-foreground">New Egg Type</div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Chicken Eggs, Duck Eggs…"
                value={newEggTypeName}
                onChange={(e) => setNewEggTypeName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newEggTypeName.trim() && createEggType.mutate({ data: { name: newEggTypeName.trim() } as any })}
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={!newEggTypeName.trim() || createEggType.isPending}
                onClick={() => createEggType.mutate({ data: { name: newEggTypeName.trim() } as any })}
              >
                {createEggType.isPending ? "Saving…" : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowEggTypeForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {(eggTypes as any[]).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Egg className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No egg types yet. Add your first egg type to start tracking inventory.
            </p>
            <Button size="sm" onClick={() => setShowEggTypeForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Egg Type
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(eggTypes as any[]).map((et: any) => (
              <span
                key={et.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card text-sm text-foreground"
              >
                <Egg className="w-3.5 h-3.5 text-muted-foreground" />
                {et.name}
                {!et.active && (
                  <span className="text-xs text-muted-foreground">(inactive)</span>
                )}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* On-Hand Summary */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          On Hand
        </h2>
        {onHandLoading ? (
          <div className="h-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : (onHand as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No egg types configured yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(onHand as any[]).map((row: any) => (
              <div
                key={row.eggTypeId}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Egg className="w-4 h-4" />
                  <span className="text-xs font-medium">{row.eggTypeName}</span>
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {row.onHandEach}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">eggs</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Record Daily Collection */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus className="w-4 h-4" /> Record Daily Collection
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Select
            value={collForm.eggTypeId}
            onValueChange={(v) => setCollForm((f) => ({ ...f, eggTypeId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Egg type…" />
            </SelectTrigger>
            <SelectContent>
              {(eggTypes as any[]).map((et: any) => (
                <SelectItem key={et.id} value={String(et.id)}>
                  {et.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={collForm.collectionDate}
            onChange={(e) =>
              setCollForm((f) => ({ ...f, collectionDate: e.target.value }))
            }
          />
          <Input
            type="number"
            min={1}
            placeholder="Count (eggs)…"
            value={collForm.countEach}
            onChange={(e) =>
              setCollForm((f) => ({ ...f, countEach: e.target.value }))
            }
          />
          <Input
            placeholder="Notes (optional)…"
            value={collForm.notes}
            onChange={(e) =>
              setCollForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </div>
        <Button
          size="sm"
          disabled={
            !collForm.eggTypeId ||
            !collForm.collectionDate ||
            !collForm.countEach ||
            createCollection.isPending
          }
          onClick={handleRecordCollection}
        >
          {createCollection.isPending ? "Saving…" : "Record Collection"}
        </Button>
      </section>

      {/* Collection History */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Collection History
        </h2>
        {(collections as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No collections recorded yet.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Egg Type
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    Count
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...(collections as any[])].reverse().map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-foreground">{c.collectionDate}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {eggTypeMap.get(c.eggTypeId) ?? `Type #${c.eggTypeId}`}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {c.countEach}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {c.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manual Adjustment */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingDown className="w-4 h-4" /> Record Adjustment
        </div>
        <p className="text-xs text-muted-foreground">
          Use positive numbers to add eggs (e.g. donation received) and negative
          numbers to subtract (e.g. breakage, personal use).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            value={adjForm.eggTypeId}
            onValueChange={(v) =>
              setAdjForm((f) => ({ ...f, eggTypeId: v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Egg type…" />
            </SelectTrigger>
            <SelectContent>
              {(eggTypes as any[]).map((et: any) => (
                <SelectItem key={et.id} value={String(et.id)}>
                  {et.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Qty (e.g. -5)…"
            value={adjForm.qtyEach}
            onChange={(e) =>
              setAdjForm((f) => ({ ...f, qtyEach: e.target.value }))
            }
          />
          <Textarea
            placeholder="Reason (required)…"
            value={adjForm.reason}
            onChange={(e) =>
              setAdjForm((f) => ({ ...f, reason: e.target.value }))
            }
            rows={1}
            className="text-sm"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={
            !adjForm.eggTypeId ||
            !adjForm.qtyEach ||
            !adjForm.reason.trim() ||
            createAdjustment.isPending
          }
          onClick={handleRecordAdjustment}
        >
          {createAdjustment.isPending ? "Saving…" : "Save Adjustment"}
        </Button>
      </section>

      {/* Adjustment Log */}
      {(adjustments as any[]).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Adjustment Log
          </h2>
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Egg Type</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...(adjustments as any[])].reverse().map((a: any) => {
                  const isEditing = editingId === a.id;
                  const isSaving = updateAdjustment.isPending && editingId === a.id;

                  return (
                    <tr key={a.id} className="hover:bg-muted/20 group">
                      <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(a.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {eggTypeMap.get(a.eggTypeId) ?? `Type #${a.eggTypeId}`}
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-4 py-1.5 text-right">
                            <Input
                              type="number"
                              value={editForm.qtyEach}
                              onChange={(e) => setEditForm((f) => ({ ...f, qtyEach: e.target.value }))}
                              className="h-7 w-24 text-right text-sm ml-auto"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingId(null); }}
                            />
                          </td>
                          <td className="px-4 py-1.5">
                            <Input
                              value={editForm.reason}
                              onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                              className="h-7 text-sm"
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingId(null); }}
                            />
                          </td>
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                disabled={isSaving || !editForm.reason.trim() || editForm.qtyEach === ""}
                                onClick={handleSaveEdit}
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                disabled={isSaving}
                                onClick={() => setEditingId(null)}
                                title="Cancel"
                              >
                                <XIcon className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={`px-4 py-2 text-right font-medium whitespace-nowrap ${a.qtyEach < 0 ? "text-red-600" : "text-green-600"}`}>
                            {a.qtyEach > 0 ? "+" : ""}{a.qtyEach}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">
                            {a.reason}
                          </td>
                          <td className="px-4 py-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                              onClick={() => handleStartEdit(a)}
                              title="Edit adjustment"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Click the pencil icon on any row to correct the quantity or reason.</p>
        </section>
      )}
    </div>
  );
}
