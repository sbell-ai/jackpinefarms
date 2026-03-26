import { useState } from "react";
import { differenceInMonths, parseISO, format } from "date-fns";
import {
  useAdminListFlocks,
  useAdminCreateFlock,
  getAdminListFlocksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Bird, ChevronDown, ChevronRight } from "lucide-react";
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

const EVENT_TYPE_LABELS: Record<string, string> = {
  acquired: "Acquired",
  hatched: "Hatched",
  culled: "Culled",
  sold: "Sold",
  died: "Died",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  acquired: "bg-blue-100 text-blue-700",
  hatched: "bg-green-100 text-green-700",
  culled: "bg-orange-100 text-orange-700",
  sold: "bg-purple-100 text-purple-700",
  died: "bg-gray-100 text-gray-500",
};

function formatAge(months: number | null | undefined): string {
  if (months == null) return "—";
  if (months < 12) return months === 1 ? "1 mo" : `${months} mo`;
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  if (mo === 0) return yrs === 1 ? "1 yr" : `${yrs} yr`;
  return `${yrs} yr ${mo} mo`;
}

function monthsFromHatchDate(hatchDate: string): number {
  return differenceInMonths(new Date(), parseISO(hatchDate));
}

async function fetchFlockEvents(flockId: number) {
  const res = await fetch(`/api/admin/flocks/${flockId}/events`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

async function createFlockEvent(flockId: number, data: Record<string, unknown>) {
  const res = await fetch(`/api/admin/flocks/${flockId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to save event");
  }
  return res.json();
}

function FlockEventsPanel({ flockId }: { flockId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const eventsKey = ["admin", "flockEvents", flockId];

  const { data: events = [], isLoading } = useQuery({
    queryKey: eventsKey,
    queryFn: () => fetchFlockEvents(flockId),
  });

  const [eventForm, setEventForm] = useState({
    eventType: "" as "acquired" | "hatched" | "culled" | "sold" | "died" | "",
    count: "",
    eventDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createFlockEvent(flockId, data),
    onSuccess: () => {
      toast({ title: "Event recorded" });
      setEventForm({ eventType: "", count: "", eventDate: format(new Date(), "yyyy-MM-dd"), notes: "" });
      qc.invalidateQueries({ queryKey: eventsKey });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!eventForm.eventType || !eventForm.count) return;
    mutation.mutate({
      eventType: eventForm.eventType,
      count: Number(eventForm.count),
      eventDate: eventForm.eventDate,
      notes: eventForm.notes || null,
    });
  };

  return (
    <div className="bg-muted/30 border-t border-border px-6 py-4 space-y-4">
      {/* Event log */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (events as any[]).length === 0 ? (
        <div className="text-xs text-muted-foreground italic">No events recorded for this flock.</div>
      ) : (
        <div className="space-y-1">
          {(events as any[]).map((ev: any) => (
            <div key={ev.id} className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground w-24 shrink-0 text-xs">{ev.eventDate}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EVENT_TYPE_COLORS[ev.eventType] ?? ""}`}>
                {EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}
              </span>
              <span className="text-foreground font-medium">{ev.count} birds</span>
              {ev.notes && <span className="text-muted-foreground text-xs truncate">{ev.notes}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Add event form */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={eventForm.eventType} onValueChange={(v) => setEventForm((f) => ({ ...f, eventType: v as any }))}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Event…" /></SelectTrigger>
          <SelectContent>
            {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number" min={1} placeholder="Count"
          value={eventForm.count}
          onChange={(e) => setEventForm((f) => ({ ...f, count: e.target.value }))}
          className="w-20 h-8 text-xs"
        />
        <Input
          type="date"
          value={eventForm.eventDate}
          onChange={(e) => setEventForm((f) => ({ ...f, eventDate: e.target.value }))}
          className="w-36 h-8 text-xs"
        />
        <Input
          placeholder="Notes (optional)"
          value={eventForm.notes}
          onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))}
          className="flex-1 min-w-32 h-8 text-xs"
        />
        <Button
          size="sm"
          className="h-8 text-xs"
          disabled={!eventForm.eventType || !eventForm.count || mutation.isPending}
          onClick={handleSubmit}
        >
          {mutation.isPending ? "Saving…" : "Record"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminFlocks() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: flocks = [], isLoading } = useAdminListFlocks({
    query: { queryKey: getAdminListFlocksQueryKey() },
  });

  const [expandedFlockId, setExpandedFlockId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "",
    species: "" as "chicken" | "duck" | "turkey" | "",
    breed: "",
    acquiredDate: "",
    hatchDate: "",
    ageMonths: "",
    henCount: "",
    roosterCount: "",
    notes: "",
  });

  const [showForm, setShowForm] = useState(false);

  const handleHatchDateChange = (value: string) => {
    const computed = value ? String(monthsFromHatchDate(value)) : "";
    setForm((f) => ({ ...f, hatchDate: value, ageMonths: computed }));
  };

  const createFlock = useAdminCreateFlock({
    mutation: {
      onSuccess: () => {
        toast({ title: "Flock added" });
        setForm({ name: "", species: "", breed: "", acquiredDate: "", hatchDate: "", ageMonths: "", henCount: "", roosterCount: "", notes: "" });
        setShowForm(false);
        qc.invalidateQueries({ queryKey: getAdminListFlocksQueryKey() });
      },
      onError: (e: any) =>
        toast({
          title: "Error",
          description: e.response?.data?.error ?? e.message,
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
        breed: form.breed || undefined,
        acquiredDate: form.acquiredDate || undefined,
        hatchDate: form.hatchDate || undefined,
        ageMonths: form.ageMonths !== "" ? Number(form.ageMonths) : undefined,
        henCount: form.henCount !== "" ? Number(form.henCount) : undefined,
        roosterCount: form.roosterCount !== "" ? Number(form.roosterCount) : undefined,
        notes: form.notes || undefined,
      } as any,
    });
  };

  const resolveAge = (flock: any): number | null => {
    if (flock.hatchDate) return monthsFromHatchDate(flock.hatchDate);
    return flock.ageMonths ?? null;
  };

  const compositionLabel = (flock: any) => {
    const parts: string[] = [];
    if (flock.henCount != null) parts.push(`${flock.henCount} hen${flock.henCount !== 1 ? "s" : ""}`);
    if (flock.roosterCount != null) parts.push(`${flock.roosterCount} rooster${flock.roosterCount !== 1 ? "s" : ""}`);
    return parts.length ? parts.join(", ") : "—";
  };

  const totalBirds = (flock: any) => {
    if (flock.henCount == null && flock.roosterCount == null) return "—";
    return (flock.henCount ?? 0) + (flock.roosterCount ?? 0);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Input
              placeholder="Flock name…"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              value={form.species}
              onValueChange={(v) => setForm((f) => ({ ...f, species: v as any }))}
            >
              <SelectTrigger><SelectValue placeholder="Species…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chicken">Chicken</SelectItem>
                <SelectItem value="duck">Duck</SelectItem>
                <SelectItem value="turkey">Turkey</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Breed (optional)"
              value={form.breed}
              onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))}
            />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Hatch date (auto-fills age)</label>
              <Input type="date" value={form.hatchDate} onChange={(e) => handleHatchDateChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Age (months)</label>
              <Input
                type="number" min={0} placeholder="e.g. 18"
                value={form.ageMonths}
                onChange={(e) => setForm((f) => ({ ...f, ageMonths: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Acquired date</label>
              <Input type="date" value={form.acquiredDate} onChange={(e) => setForm((f) => ({ ...f, acquiredDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Hens</label>
              <Input type="number" min={0} placeholder="# of hens" value={form.henCount} onChange={(e) => setForm((f) => ({ ...f, henCount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Roosters</label>
              <Input type="number" min={0} placeholder="# of roosters" value={form.roosterCount} onChange={(e) => setForm((f) => ({ ...f, roosterCount: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
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
            <Button size="sm" disabled={!form.name || !form.species || createFlock.isPending} onClick={handleSubmit}>
              {createFlock.isPending ? "Saving…" : "Add Flock"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-24 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (flocks as any[]).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Bird className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No flocks yet. Add your first flock to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          {/* Header */}
          <div className="bg-muted/40 grid grid-cols-[24px_1fr_1fr_1fr_80px_120px_80px_80px_80px] gap-x-4 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span />
            <span>Name</span>
            <span>Species / Breed</span>
            <span>Status</span>
            <span>Age</span>
            <span>Composition</span>
            <span>Total</span>
            <span>Acquired</span>
            <span>Notes</span>
          </div>
          {(flocks as any[]).map((flock: any) => (
            <div key={flock.id}>
              <div
                className="grid grid-cols-[24px_1fr_1fr_1fr_80px_120px_80px_80px_80px] gap-x-4 px-4 py-3 hover:bg-muted/20 cursor-pointer items-center text-sm"
                onClick={() => setExpandedFlockId(expandedFlockId === flock.id ? null : flock.id)}
              >
                <span className="text-muted-foreground">
                  {expandedFlockId === flock.id
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />}
                </span>
                <span className="font-medium text-foreground">{flock.name}</span>
                <span className="text-muted-foreground capitalize">
                  {flock.species}{flock.breed ? ` · ${flock.breed}` : ""}
                </span>
                <span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[flock.status] ?? ""}`}>
                    {flock.status}
                  </span>
                </span>
                <span className="text-muted-foreground">{formatAge(resolveAge(flock))}</span>
                <span className="text-muted-foreground text-xs">{compositionLabel(flock)}</span>
                <span className="text-foreground font-medium">{totalBirds(flock)}</span>
                <span className="text-muted-foreground text-xs">{flock.acquiredDate ?? "—"}</span>
                <span className="text-muted-foreground text-xs truncate">{flock.notes ?? "—"}</span>
              </div>
              {expandedFlockId === flock.id && (
                <FlockEventsPanel flockId={flock.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
