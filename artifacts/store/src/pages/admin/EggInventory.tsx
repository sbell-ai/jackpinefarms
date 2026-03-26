import { useState } from "react";
import { format } from "date-fns";
import {
  useAdminGetEggInventoryOnHand,
  useAdminListEggTypes,
  useAdminListEggCollection,
  useAdminCreateEggCollection,
  useAdminListEggAdjustments,
  useAdminCreateEggAdjustment,
  getAdminGetEggInventoryOnHandQueryKey,
  getAdminListEggCollectionQueryKey,
  getAdminListEggAdjustmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Egg, TrendingDown, TrendingUp, Plus } from "lucide-react";
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

  const { data: eggTypes = [] } = useAdminListEggTypes({});

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

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getAdminGetEggInventoryOnHandQueryKey() });
    qc.invalidateQueries({ queryKey: getAdminListEggCollectionQueryKey({}) });
    qc.invalidateQueries({ queryKey: getAdminListEggAdjustmentsQueryKey({}) });
  };

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
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
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
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Egg Type
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    Qty
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...(adjustments as any[])].reverse().map((a: any) => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {format(new Date(a.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {eggTypeMap.get(a.eggTypeId) ?? `Type #${a.eggTypeId}`}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        a.qtyEach < 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {a.qtyEach > 0 ? "+" : ""}
                      {a.qtyEach}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {a.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
