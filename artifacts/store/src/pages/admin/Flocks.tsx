import { useState } from "react";
import {
  useAdminListFlocks,
  useAdminCreateFlock,
  getAdminListFlocksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  retired: "bg-gray-100 text-gray-600",
};

export default function AdminFlocks() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: flocks = [], isLoading } = useAdminListFlocks({
    query: { queryKey: getAdminListFlocksQueryKey() },
  });

  const [form, setForm] = useState({
    name: "",
    species: "" as "chicken" | "duck" | "turkey" | "",
    acquiredDate: "",
    notes: "",
  });

  const [showForm, setShowForm] = useState(false);

  const createFlock = useAdminCreateFlock({
    mutation: {
      onSuccess: () => {
        toast({ title: "Flock added" });
        setForm({ name: "", species: "", acquiredDate: "", notes: "" });
        setShowForm(false);
        qc.invalidateQueries({ queryKey: getAdminListFlocksQueryKey() });
      },
      onError: (e: any) =>
        toast({
          title: "Error",
          description: e.message,
          variant: "destructive",
        }),
    },
  });

  const handleSubmit = () => {
    if (!form.name || !form.species) return;
    createFlock.mutate({
      data: {
        name: form.name,
        species: form.species as "chicken" | "duck" | "turkey",
        acquiredDate: form.acquiredDate || undefined,
        notes: form.notes || undefined,
      } as any,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flocks</h1>
          <p className="text-muted-foreground mt-1">
            Manage your laying flocks and flock history.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Add Flock
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="text-sm font-semibold text-foreground">New Flock</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              placeholder="Flock name…"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              value={form.species}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, species: v as any }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Species…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chicken">Chicken</SelectItem>
                <SelectItem value="duck">Duck</SelectItem>
                <SelectItem value="turkey">Turkey</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Acquired date…"
              value={form.acquiredDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, acquiredDate: e.target.value }))
              }
            />
            <Textarea
              placeholder="Notes (optional)…"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={1}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!form.name || !form.species || createFlock.isPending}
              onClick={handleSubmit}
            >
              {createFlock.isPending ? "Saving…" : "Add Flock"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-24 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (flocks as any[]).length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No flocks yet. Add your first flock to get started.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Species</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Acquired</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(flocks as any[]).map((flock: any) => (
                <tr key={flock.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{flock.name}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{flock.species}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[flock.status] ?? ""}`}>
                      {flock.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {flock.acquiredDate ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {flock.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
