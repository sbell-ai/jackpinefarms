import { useState, useEffect } from "react";
import { differenceInMonths, parseISO, format } from "date-fns";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Bird, ChevronDown, ChevronRight, Pencil, X, Check, Loader2, Rabbit,
} from "lucide-react";
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

const btnSmallPrimary =
  "px-3 py-1.5 rounded-md bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const btnSmallSecondary =
  "px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  retired: "bg-gray-100 text-gray-600",
};

const ANIMAL_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  sold: "bg-purple-100 text-purple-800",
  deceased: "bg-gray-100 text-gray-600",
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

const SEX_LABELS: Record<string, string> = {
  hen: "Hen",
  rooster: "Rooster",
  unknown: "Unknown",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcAgeMonths(hatchDate?: string | null): number | null {
  if (!hatchDate) return null;
  return differenceInMonths(new Date(), parseISO(hatchDate));
}

function formatAge(months: number | null | undefined): string {
  if (months == null) return "—";
  if (months < 12) return months === 1 ? "1 mo" : `${months} mo`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  if (mo === 0) return yr === 1 ? "1 yr" : `${yr} yr`;
  return `${yr} yr ${mo} mo`;
}

function resolveAge(flock: Flock): number | null {
  if (flock.hatchDate) return calcAgeMonths(flock.hatchDate);
  return flock.ageMonths ?? null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Flock {
  id: number;
  name: string;
  species: string;
  breed: string | null;
  acquiredDate: string | null;
  hatchDate: string | null;
  ageMonths: number | null;
  henCount: number | null;
  roosterCount: number | null;
  status: string;
  notes: string | null;
}

// Editing state uses strings for numeric fields (all form inputs are strings)
interface EditingFlock {
  id: number;
  name: string;
  species: string;
  breed: string;
  acquiredDate: string;
  hatchDate: string;
  ageMonths: string;
  henCount: string;
  roosterCount: string;
  status: string;
  notes: string;
}

interface FlockEvent {
  id: number;
  flockId: number;
  eventType: string;
  count: number;
  eventDate: string;
  notes: string | null;
}

interface Animal {
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
}

// ─── FlockEventsPanel ─────────────────────────────────────────────────────────

function FlockEventsPanel({ flockId }: { flockId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const eventsKey = ["farmops", "flockEvents", flockId];

  const { data: events = [], isLoading } = useQuery<FlockEvent[]>({
    queryKey: eventsKey,
    queryFn: async () => {
      const res = await fetch(`/api/farmops/flocks/${flockId}/events`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load events");
      return res.json();
    },
  });

  const [eventForm, setEventForm] = useState({
    eventType: "",
    count: "",
    eventDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/farmops/flocks/${flockId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save event");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Event recorded" });
      setEventForm({ eventType: "", count: "", eventDate: format(new Date(), "yyyy-MM-dd"), notes: "" });
      qc.invalidateQueries({ queryKey: eventsKey });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleRecord = () => {
    if (!eventForm.eventType || !eventForm.count) return;
    mutation.mutate({
      eventType: eventForm.eventType,
      count: Number(eventForm.count),
      eventDate: eventForm.eventDate,
      notes: eventForm.notes || null,
    });
  };

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 space-y-4">
      {/* Event log */}
      {isLoading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No events recorded for this flock.</p>
      ) : (
        <div className="space-y-1.5">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 text-sm">
              <span className="text-slate-400 text-xs w-24 shrink-0">{ev.eventDate}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  EVENT_TYPE_COLORS[ev.eventType] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}
              </span>
              <span className="text-slate-700 font-medium">{ev.count} birds</span>
              {ev.notes && (
                <span className="text-slate-400 text-xs truncate">{ev.notes}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add event inline */}
      <div className="flex flex-wrap gap-2 items-end">
        <select
          value={eventForm.eventType}
          onChange={(e) => setEventForm((f) => ({ ...f, eventType: e.target.value }))}
          className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all appearance-none w-32"
        >
          <option value="">Event…</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          placeholder="Count"
          value={eventForm.count}
          onChange={(e) => setEventForm((f) => ({ ...f, count: e.target.value }))}
          className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all w-20"
        />
        <input
          type="date"
          value={eventForm.eventDate}
          onChange={(e) => setEventForm((f) => ({ ...f, eventDate: e.target.value }))}
          className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all w-36"
        />
        <input
          placeholder="Notes (optional)"
          value={eventForm.notes}
          onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))}
          className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all flex-1 min-w-28"
        />
        <button
          onClick={handleRecord}
          disabled={!eventForm.eventType || !eventForm.count || mutation.isPending}
          className={btnSmallPrimary}
        >
          {mutation.isPending ? "Saving…" : "Record"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const BLANK_FLOCK_FORM = {
  name: "",
  species: "",
  breed: "",
  acquiredDate: "",
  hatchDate: "",
  ageMonths: "",
  henCount: "",
  roosterCount: "",
  notes: "",
};

const BLANK_ANIMAL_FORM = {
  name: "",
  species: "",
  breed: "",
  sex: "unknown",
  birthDate: "",
  acquiredDate: "",
  flockId: "",
  notes: "",
};

export default function FarmOpsFlocks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();

  useEffect(() => {
    if (!sessionLoading && !session) setLocation("/farmops/login");
  }, [session, sessionLoading, setLocation]);

  // ── Flock state ──
  const [expandedFlockId, setExpandedFlockId] = useState<number | null>(null);
  const [editingFlock, setEditingFlock] = useState<EditingFlock | null>(null);
  const [showFlockForm, setShowFlockForm] = useState(false);
  const [flockForm, setFlockForm] = useState({ ...BLANK_FLOCK_FORM });

  // ── Animal state ──
  const [showAnimalForm, setShowAnimalForm] = useState(false);
  const [animalForm, setAnimalForm] = useState({ ...BLANK_ANIMAL_FORM });

  // ── Queries ──
  const { data: flocks = [], isLoading: flocksLoading } = useQuery<Flock[]>({
    queryKey: ["farmops", "flocks"],
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch("/api/farmops/flocks", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load flocks");
      return res.json();
    },
  });

  const { data: animals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ["farmops", "animals"],
    enabled: !!session,
    queryFn: async () => {
      const res = await fetch("/api/farmops/animals", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load animals");
      return res.json();
    },
  });

  // ── Flock mutations ──
  const createFlock = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/farmops/flocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Flock added" });
      setFlockForm({ ...BLANK_FLOCK_FORM });
      setShowFlockForm(false);
      qc.invalidateQueries({ queryKey: ["farmops", "flocks"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateFlock = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/farmops/flocks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Flock updated" });
      setEditingFlock(null);
      qc.invalidateQueries({ queryKey: ["farmops", "flocks"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Animal mutations ──
  const createAnimal = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/farmops/animals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Animal added" });
      setAnimalForm({ ...BLANK_ANIMAL_FORM });
      setShowAnimalForm(false);
      qc.invalidateQueries({ queryKey: ["farmops", "animals"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Handlers ──
  const handleHatchDateChange = (value: string, target: "form" | "edit") => {
    const months = value ? String(calcAgeMonths(value) ?? "") : "";
    if (target === "form") {
      setFlockForm((f) => ({ ...f, hatchDate: value, ageMonths: months }));
    } else {
      setEditingFlock((f) => f ? { ...f, hatchDate: value, ageMonths: months } : null);
    }
  };

  const handleCreateFlock = () => {
    if (!flockForm.name || !flockForm.species) return;
    createFlock.mutate({
      name: flockForm.name,
      species: flockForm.species,
      breed: flockForm.breed || null,
      acquiredDate: flockForm.acquiredDate || null,
      hatchDate: flockForm.hatchDate || null,
      ageMonths: flockForm.ageMonths !== "" ? Number(flockForm.ageMonths) : null,
      henCount: flockForm.henCount !== "" ? Number(flockForm.henCount) : null,
      roosterCount: flockForm.roosterCount !== "" ? Number(flockForm.roosterCount) : null,
      notes: flockForm.notes || null,
    });
  };

  const handleSaveEdit = () => {
    if (!editingFlock || !editingFlock.name || !editingFlock.species) return;
    updateFlock.mutate({
      id: editingFlock.id,
      data: {
        name: editingFlock.name,
        species: editingFlock.species,
        breed: editingFlock.breed || null,
        acquiredDate: editingFlock.acquiredDate || null,
        hatchDate: editingFlock.hatchDate || null,
        ageMonths: editingFlock.ageMonths !== "" ? Number(editingFlock.ageMonths) : null,
        henCount: editingFlock.henCount !== "" ? Number(editingFlock.henCount) : null,
        roosterCount: editingFlock.roosterCount !== "" ? Number(editingFlock.roosterCount) : null,
        status: editingFlock.status,
        notes: editingFlock.notes || null,
      },
    });
  };

  const startEditFlock = (flock: Flock) => {
    setEditingFlock({
      id: flock.id,
      name: flock.name,
      species: flock.species,
      status: flock.status,
      breed: flock.breed ?? "",
      acquiredDate: flock.acquiredDate ?? "",
      hatchDate: flock.hatchDate ?? "",
      ageMonths: flock.ageMonths != null ? String(flock.ageMonths) : "",
      henCount: flock.henCount != null ? String(flock.henCount) : "",
      roosterCount: flock.roosterCount != null ? String(flock.roosterCount) : "",
      notes: flock.notes ?? "",
    });
  };

  const handleCreateAnimal = () => {
    if (!animalForm.species) return;
    createAnimal.mutate({
      name: animalForm.name || null,
      species: animalForm.species,
      breed: animalForm.breed || null,
      sex: animalForm.sex,
      birthDate: animalForm.birthDate || null,
      acquiredDate: animalForm.acquiredDate || null,
      flockId: animalForm.flockId ? Number(animalForm.flockId) : null,
      notes: animalForm.notes || null,
    });
  };

  const flockName = (id: number | null) => {
    if (!id) return "—";
    return flocks.find((f) => f.id === id)?.name ?? "—";
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* ── Flocks ──────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bird className="w-6 h-6 text-emerald-600" />
              Flocks
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your laying flocks and flock history.
            </p>
          </div>
          <button
            onClick={() => setShowFlockForm((v) => !v)}
            className={btnPrimary}
          >
            <span className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Add Flock
            </span>
          </button>
        </div>

        {/* Add flock form */}
        {showFlockForm && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-700">New Flock</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                placeholder="Flock name…"
                value={flockForm.name}
                onChange={(e) => setFlockForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
              <select
                value={flockForm.species}
                onChange={(e) => setFlockForm((f) => ({ ...f, species: e.target.value }))}
                className={selectCls}
              >
                <option value="">Species…</option>
                <option value="chicken">Chicken</option>
                <option value="duck">Duck</option>
                <option value="turkey">Turkey</option>
              </select>
              <input
                placeholder="Breed (optional)"
                value={flockForm.breed}
                onChange={(e) => setFlockForm((f) => ({ ...f, breed: e.target.value }))}
                className={inputCls}
              />
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Hatch date (auto-fills age)</label>
                <input
                  type="date"
                  value={flockForm.hatchDate}
                  onChange={(e) => handleHatchDateChange(e.target.value, "form")}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Age (months)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 18"
                  value={flockForm.ageMonths}
                  onChange={(e) => setFlockForm((f) => ({ ...f, ageMonths: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Acquired date</label>
                <input
                  type="date"
                  value={flockForm.acquiredDate}
                  onChange={(e) => setFlockForm((f) => ({ ...f, acquiredDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Hens</label>
                <input
                  type="number"
                  min={0}
                  placeholder="# of hens"
                  value={flockForm.henCount}
                  onChange={(e) => setFlockForm((f) => ({ ...f, henCount: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Roosters</label>
                <input
                  type="number"
                  min={0}
                  placeholder="# of roosters"
                  value={flockForm.roosterCount}
                  onChange={(e) => setFlockForm((f) => ({ ...f, roosterCount: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <textarea
                  placeholder="Notes (optional)…"
                  rows={2}
                  value={flockForm.notes}
                  onChange={(e) => setFlockForm((f) => ({ ...f, notes: e.target.value }))}
                  className={inputCls + " resize-none"}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateFlock}
                disabled={!flockForm.name || !flockForm.species || createFlock.isPending}
                className={btnPrimary}
              >
                {createFlock.isPending ? "Saving…" : "Add Flock"}
              </button>
              <button onClick={() => setShowFlockForm(false)} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Flocks table */}
        {flocksLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : flocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <Bird className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              No flocks yet. Add your first flock to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid gap-x-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 min-w-[820px]"
                style={{ gridTemplateColumns: "24px 1fr 1fr 90px 60px 110px 60px 80px 80px 32px" }}>
                <span />
                <span>Name</span>
                <span>Species / Breed</span>
                <span>Status</span>
                <span>Age</span>
                <span>Composition</span>
                <span>Total</span>
                <span>Acquired</span>
                <span>Notes</span>
                <span />
              </div>

              <div className="divide-y divide-slate-100">
                {flocks.map((flock) => (
                  <div key={flock.id}>
                    {/* Row */}
                    <div
                      className="grid gap-x-3 px-4 py-3 hover:bg-slate-50 cursor-pointer items-center text-sm min-w-[820px]"
                      style={{ gridTemplateColumns: "24px 1fr 1fr 90px 60px 110px 60px 80px 80px 32px" }}
                      onClick={() =>
                        setExpandedFlockId(expandedFlockId === flock.id ? null : flock.id)
                      }
                    >
                      <span className="text-slate-400">
                        {expandedFlockId === flock.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                      <span className="font-medium text-slate-900">{flock.name}</span>
                      <span className="text-slate-500 capitalize">
                        {flock.species}{flock.breed ? ` · ${flock.breed}` : ""}
                      </span>
                      <span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            STATUS_COLORS[flock.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {flock.status}
                        </span>
                      </span>
                      <span className="text-slate-500">{formatAge(resolveAge(flock))}</span>
                      <span className="text-slate-500 text-xs">
                        {[
                          flock.henCount != null && `${flock.henCount} hen${flock.henCount !== 1 ? "s" : ""}`,
                          flock.roosterCount != null && `${flock.roosterCount} rooster${flock.roosterCount !== 1 ? "s" : ""}`,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </span>
                      <span className="font-medium text-slate-800">
                        {flock.henCount != null || flock.roosterCount != null
                          ? (flock.henCount ?? 0) + (flock.roosterCount ?? 0)
                          : "—"}
                      </span>
                      <span className="text-slate-400 text-xs">
                        {flock.acquiredDate ?? "—"}
                      </span>
                      <span className="text-slate-400 text-xs truncate">
                        {flock.notes ?? "—"}
                      </span>
                      <span onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() =>
                            editingFlock?.id === flock.id
                              ? setEditingFlock(null)
                              : startEditFlock(flock)
                          }
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          {editingFlock?.id === flock.id ? (
                            <X className="w-3.5 h-3.5" />
                          ) : (
                            <Pencil className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </span>
                    </div>

                    {/* Edit panel */}
                    {editingFlock?.id === flock.id && (
                      <div className="border-t border-slate-200 bg-amber-50 px-5 py-4 space-y-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Edit Flock
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          <input
                            placeholder="Name"
                            value={editingFlock.name}
                            onChange={(e) =>
                              setEditingFlock((f) => f ? { ...f, name: e.target.value } : null)
                            }
                            className={inputCls}
                          />
                          <select
                            value={editingFlock.species}
                            onChange={(e) =>
                              setEditingFlock((f) => f ? { ...f, species: e.target.value } : null)
                            }
                            className={selectCls}
                          >
                            <option value="">Species…</option>
                            <option value="chicken">Chicken</option>
                            <option value="duck">Duck</option>
                            <option value="turkey">Turkey</option>
                          </select>
                          <input
                            placeholder="Breed"
                            value={editingFlock.breed}
                            onChange={(e) =>
                              setEditingFlock((f) => f ? { ...f, breed: e.target.value } : null)
                            }
                            className={inputCls}
                          />
                          <select
                            value={editingFlock.status}
                            onChange={(e) =>
                              setEditingFlock((f) => f ? { ...f, status: e.target.value } : null)
                            }
                            className={selectCls}
                          >
                            <option value="active">Active</option>
                            <option value="retired">Retired</option>
                          </select>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Hatch date</label>
                            <input
                              type="date"
                              value={editingFlock.hatchDate}
                              onChange={(e) => handleHatchDateChange(e.target.value, "edit")}
                              className={inputCls}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Age (months)</label>
                            <input
                              type="number"
                              min={0}
                              value={editingFlock.ageMonths}
                              onChange={(e) =>
                                setEditingFlock((f) => f ? { ...f, ageMonths: e.target.value } : null)
                              }
                              className={inputCls}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Acquired date</label>
                            <input
                              type="date"
                              value={editingFlock.acquiredDate}
                              onChange={(e) =>
                                setEditingFlock((f) => f ? { ...f, acquiredDate: e.target.value } : null)
                              }
                              className={inputCls}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Hens</label>
                            <input
                              type="number"
                              min={0}
                              value={editingFlock.henCount}
                              onChange={(e) =>
                                setEditingFlock((f) => f ? { ...f, henCount: e.target.value } : null)
                              }
                              className={inputCls}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Roosters</label>
                            <input
                              type="number"
                              min={0}
                              value={editingFlock.roosterCount}
                              onChange={(e) =>
                                setEditingFlock((f) => f ? { ...f, roosterCount: e.target.value } : null)
                              }
                              className={inputCls}
                            />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-3">
                            <textarea
                              rows={2}
                              placeholder="Notes…"
                              value={editingFlock.notes}
                              onChange={(e) =>
                                setEditingFlock((f) => f ? { ...f, notes: e.target.value } : null)
                              }
                              className={inputCls + " resize-none"}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={
                              !editingFlock.name || !editingFlock.species || updateFlock.isPending
                            }
                            className={btnSmallPrimary}
                          >
                            <span className="flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              {updateFlock.isPending ? "Saving…" : "Save"}
                            </span>
                          </button>
                          <button
                            onClick={() => setEditingFlock(null)}
                            className={btnSmallSecondary}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Events panel */}
                    {expandedFlockId === flock.id && (
                      <FlockEventsPanel flockId={flock.id} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Animals ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Rabbit className="w-5 h-5 text-emerald-600" />
              Individual Animals
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Track breeding stock and named animals.
            </p>
          </div>
          <button
            onClick={() => setShowAnimalForm((v) => !v)}
            className={btnPrimary}
          >
            <span className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Add Animal
            </span>
          </button>
        </div>

        {/* Add animal form */}
        {showAnimalForm && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-700">New Animal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Name (optional)</label>
                <input
                  placeholder="e.g. Rosie"
                  value={animalForm.name}
                  onChange={(e) => setAnimalForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Species</label>
                <select
                  value={animalForm.species}
                  onChange={(e) => setAnimalForm((f) => ({ ...f, species: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">Species…</option>
                  <option value="chicken">Chicken</option>
                  <option value="duck">Duck</option>
                  <option value="turkey">Turkey</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Breed</label>
                <input
                  placeholder="e.g. Rhode Island Red"
                  value={animalForm.breed}
                  onChange={(e) => setAnimalForm((f) => ({ ...f, breed: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Sex</label>
                <select
                  value={animalForm.sex}
                  onChange={(e) => setAnimalForm((f) => ({ ...f, sex: e.target.value }))}
                  className={selectCls}
                >
                  <option value="hen">Hen</option>
                  <option value="rooster">Rooster</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Birth / hatch date</label>
                <input
                  type="date"
                  value={animalForm.birthDate}
                  onChange={(e) => setAnimalForm((f) => ({ ...f, birthDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Acquired date</label>
                <input
                  type="date"
                  value={animalForm.acquiredDate}
                  onChange={(e) => setAnimalForm((f) => ({ ...f, acquiredDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Flock (optional)</label>
                <select
                  value={animalForm.flockId}
                  onChange={(e) => setAnimalForm((f) => ({ ...f, flockId: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">No flock</option>
                  {flocks.map((fl) => (
                    <option key={fl.id} value={String(fl.id)}>
                      {fl.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <textarea
                  placeholder="Notes (optional)…"
                  rows={2}
                  value={animalForm.notes}
                  onChange={(e) => setAnimalForm((f) => ({ ...f, notes: e.target.value }))}
                  className={inputCls + " resize-none"}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateAnimal}
                disabled={!animalForm.species || createAnimal.isPending}
                className={btnPrimary}
              >
                {createAnimal.isPending ? "Saving…" : "Add Animal"}
              </button>
              <button onClick={() => setShowAnimalForm(false)} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Animals table */}
        {animalsLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : animals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <Rabbit className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No individual animals recorded yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Name", "Species", "Breed", "Sex", "Status", "Flock", "Birth date", "Notes"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 text-xs font-medium text-slate-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {animals.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {a.name ?? (
                          <span className="text-slate-400 italic">unnamed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 capitalize">{a.species}</td>
                      <td className="px-4 py-3 text-slate-500">{a.breed ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {SEX_LABELS[a.sex] ?? a.sex}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ANIMAL_STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{flockName(a.flockId)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {a.birthDate ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-40">
                        {a.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
