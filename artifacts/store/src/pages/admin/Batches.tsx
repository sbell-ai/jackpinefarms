import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  useAdminListBatches,
  getAdminListBatchesQueryKey,
  useAdminCreateBatch,
  useAdminUpdateBatch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Layers, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-700",
  complete: "bg-teal-100 text-teal-800",
};

interface BatchForm {
  productId: string;
  name: string;
  status: string;
  capacityBirds: string;
  pricePerLbCentsWhole: string;
  pricePerLbCentsHalf: string;
  pricePerLbCentsQuarter: string;
  notes: string;
}

const EMPTY_FORM: BatchForm = {
  productId: "",
  name: "",
  status: "open",
  capacityBirds: "",
  pricePerLbCentsWhole: "",
  pricePerLbCentsHalf: "",
  pricePerLbCentsQuarter: "",
  notes: "",
};

function centsFromDollars(val: string): number {
  return Math.round(parseFloat(val) * 100);
}

export default function AdminBatches() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<BatchForm>(EMPTY_FORM);

  const { data: batches = [], isLoading } = useAdminListBatches({
    query: { queryKey: getAdminListBatchesQueryKey() },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getAdminListBatchesQueryKey() });

  const createBatch = useAdminCreateBatch({
    mutation: {
      onSuccess: () => { toast({ title: "Batch created" }); setDialogOpen(false); invalidate(); },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  const updateBatch = useAdminUpdateBatch({
    mutation: {
      onSuccess: () => { toast({ title: "Batch updated" }); setDialogOpen(false); invalidate(); },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(batch: any) {
    setEditing(batch);
    setForm({
      productId: String(batch.productId),
      name: batch.name,
      status: batch.status,
      capacityBirds: String(batch.capacityBirds),
      pricePerLbCentsWhole: (batch.pricePerLbCentsWhole / 100).toFixed(2),
      pricePerLbCentsHalf: (batch.pricePerLbCentsHalf / 100).toFixed(2),
      pricePerLbCentsQuarter: (batch.pricePerLbCentsQuarter / 100).toFixed(2),
      notes: batch.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      productId: Number(form.productId),
      name: form.name,
      status: form.status as any,
      capacityBirds: Number(form.capacityBirds),
      pricePerLbCentsWhole: centsFromDollars(form.pricePerLbCentsWhole),
      pricePerLbCentsHalf: centsFromDollars(form.pricePerLbCentsHalf),
      pricePerLbCentsQuarter: centsFromDollars(form.pricePerLbCentsQuarter),
      notes: form.notes || null,
    };
    if (editing) {
      updateBatch.mutate({ id: editing.id, data: payload });
    } else {
      createBatch.mutate({ data: payload });
    }
  }

  const f = (key: keyof BatchForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Preorder Batches</h1>
          <p className="text-muted-foreground mt-1">{batches.length} batch{batches.length !== 1 ? "es" : ""}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Batch
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No batches yet. Create one to start taking preorders for meat.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch: any) => (
            <div
              key={batch.id}
              className="rounded-lg border border-border bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{batch.name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[batch.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {batch.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {batch.orderCount} order{batch.orderCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 space-x-3">
                  <span>Capacity: {batch.capacityBirds} birds</span>
                  <span>Whole: ${(batch.pricePerLbCentsWhole / 100).toFixed(2)}/lb</span>
                  <span>Half: ${(batch.pricePerLbCentsHalf / 100).toFixed(2)}/lb</span>
                  <span>Quarter: ${(batch.pricePerLbCentsQuarter / 100).toFixed(2)}/lb</span>
                </div>
                {batch.notes && (
                  <div className="text-xs text-muted-foreground mt-0.5 italic">{batch.notes}</div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">
                  Created {format(new Date(batch.createdAt), "MMM d, yyyy")}
                </div>
              </div>
              <button
                onClick={() => openEdit(batch)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Edit batch"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Batch" : "New Preorder Batch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Batch Name</Label>
                <Input placeholder="e.g. Fall 2026 Whole Chickens" {...f("name")} />
              </div>
              <div className="space-y-1">
                <Label>Product ID</Label>
                <Input type="number" placeholder="Product ID" {...f("productId")} />
              </div>
              <div className="space-y-1">
                <Label>Capacity (birds)</Label>
                <Input type="number" placeholder="e.g. 50" {...f("capacityBirds")} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Whole ($/lb)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 8.50" {...f("pricePerLbCentsWhole")} />
              </div>
              <div className="space-y-1">
                <Label>Half ($/lb)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 9.00" {...f("pricePerLbCentsHalf")} />
              </div>
              <div className="space-y-1">
                <Label>Quarter ($/lb)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 9.50" {...f("pricePerLbCentsQuarter")} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Notes (optional)</Label>
                <Input placeholder="Internal notes about this batch…" {...f("notes")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={createBatch.isPending || updateBatch.isPending}
              onClick={handleSubmit}
            >
              {editing ? "Save Changes" : "Create Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
