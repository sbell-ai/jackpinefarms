import { useState } from "react";
import { differenceInMonths, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Rabbit } from "lucide-react";
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
import { useAdminListFlocks, getAdminListFlocksQueryKey } from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  sold: "bg-blue-100 text-blue-700",
  deceased: "bg-gray-100 text-gray-500",
};

const SEX_LABELS: Record<string, string> = {
  hen: "Hen",
  rooster: "Rooster",
  unknown: "Unknown",
};

function formatAge(birthDate: string | null | undefined): string {
  if (!birthDate) return "—";
  const months = differenceInMonths(new Date(), parseISO(birthDate));
  if (months < 12) return months === 1 ? "1 mo" : `${months} mo`;
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  if (mo === 0) return yrs === 1 ? "1 yr" : `${yrs} yr`;
  return `${yrs} yr ${mo} mo`;
}

type Animal = {
  id: number;
  name: string | null;
  species: string;
  breed: string | null;
  sex: string;
  birthDate: string | null;
  acquiredDate: string | null;
  status: string;
  flockId: number | null;
  notes: string | null;
};

async function fetchAnimals(): Promise<Animal[]> {
  const res = await fetch(`/api/admin/animals`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch animals");
  return res.json();
}

async function createAnimal(data: Record<string, unknown>): Promise<Animal> {
  const res = await fetch(`/api/admin/animals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to create animal");
  }
  return res.json();
}

import { useQuery, useMutation } from "@tanstack/react-query";

const ANIMALS_KEY = ["admin", "animals"];

export default function AdminAnimals() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: animals = [], isLoading } = useQuery({
    queryKey: ANIMALS_KEY,
    queryFn: fetchAnimals,
  });

  const { data: flocks = [] } = useAdminListFlocks({
    query: { queryKey: getAdminListFlocksQueryKey() },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    species: "" as "chicken" | "duck" | "turkey" | "",
    breed: "",
    sex: "unknown" as "hen" | "rooster" | "unknown",
    birthDate: "",
    acquiredDate: "",
    flockId: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: createAnimal,
    onSuccess: () => {
      toast({ title: "Animal added" });
      setForm({ name: "", species: "", breed: "", sex: "unknown", birthDate: "", acquiredDate: "", flockId: "", notes: "" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ANIMALS_KEY });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.species) return;
    mutation.mutate({
      name: form.name || null,
      species: form.species,
      breed: form.breed || null,
      sex: form.sex,
      birthDate: form.birthDate || null,
      acquiredDate: form.acquiredDate || null,
      flockId: form.flockId ? Number(form.flockId) : null,
      notes: form.notes || null,
    });
  };

  const flockName = (id: number | null) => {
    if (!id) return "—";
    return (flocks as any[]).find((f: any) => f.id === id)?.name ?? "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Individual Animals</h1>
          <p className="text-muted-foreground mt-1">
            Track breeding stock and named animals.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Add Animal
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="text-sm font-semibold text-foreground">New Animal</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Name (optional)</label>
              <Input
                placeholder="e.g. Rosie"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Species</label>
              <Select value={form.species} onValueChange={(v) => setForm((f) => ({ ...f, species: v as any }))}>
                <SelectTrigger><SelectValue placeholder="Species…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chicken">Chicken</SelectItem>
                  <SelectItem value="duck">Duck</SelectItem>
                  <SelectItem value="turkey">Turkey</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Breed</label>
              <Input
                placeholder="e.g. Rhode Island Red"
                value={form.breed}
                onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Sex</label>
              <Select value={form.sex} onValueChange={(v) => setForm((f) => ({ ...f, sex: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hen">Hen</SelectItem>
                  <SelectItem value="rooster">Rooster</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Birth / hatch date</label>
              <Input type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Acquired date</label>
              <Input type="date" value={form.acquiredDate} onChange={(e) => setForm((f) => ({ ...f, acquiredDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Flock (optional)</label>
              <Select value={form.flockId} onValueChange={(v) => setForm((f) => ({ ...f, flockId: v }))}>
                <SelectTrigger><SelectValue placeholder="No flock" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {(flocks as any[]).map((fl: any) => (
                    <SelectItem key={fl.id} value={String(fl.id)}>{fl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Textarea
                placeholder="Notes (optional)…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.species || mutation.isPending} onClick={handleSubmit}>
              {mutation.isPending ? "Saving…" : "Add Animal"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-24 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (animals as Animal[]).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Rabbit className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No individual animals recorded yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Species</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Breed</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sex</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Age</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Flock</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(animals as Animal[]).map((a) => (
                <tr key={a.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{a.name ?? <span className="text-muted-foreground italic">unnamed</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{a.species}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.breed ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{SEX_LABELS[a.sex] ?? a.sex}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatAge(a.birthDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? ""}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{flockName(a.flockId)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{a.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
