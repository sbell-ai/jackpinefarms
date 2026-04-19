import { useEffect, useState, useCallback } from "react";
import { Loader2, Inbox } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Status = "new" | "in_review" | "confirmed" | "declined";

interface PopupMarketRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  eventLocation: string;
  preferredDate: string | null;
  alternateDate: string | null;
  estimatedAttendees: string | null;
  eventType: string | null;
  productsInterested: string[];
  notes: string | null;
  status: Status;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  data: PopupMarketRequest[];
  total: number;
  page: number;
  limit: number;
}

const TABS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "in_review", label: "In Review" },
  { key: "confirmed", label: "Confirmed" },
  { key: "declined", label: "Declined" },
];

const STATUS_BADGE: Record<Status, string> = {
  new: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  in_review: "In Review",
  confirmed: "Confirmed",
  declined: "Declined",
};

const LIMIT = 20;

export default function PopupMarketMessages() {
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("new");
  const [page, setPage] = useState(1);
  const [listData, setListData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [selected, setSelected] = useState<PopupMarketRequest | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [adminNotes, setAdminNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/popup-market-requests?${params}`);
      if (res.ok) setListData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  const fetchCounts = useCallback(async () => {
    const keys: Array<"all" | Status> = ["all", "new", "in_review", "confirmed", "declined"];
    const results = await Promise.all(
      keys.map(async (k) => {
        const params = new URLSearchParams({ page: "1", limit: "1" });
        if (k !== "all") params.set("status", k);
        const res = await fetch(`/api/admin/popup-market-requests?${params}`);
        if (!res.ok) return [k, 0] as const;
        const json: ListResponse = await res.json();
        return [k, json.total] as const;
      })
    );
    setCounts(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleSelectRow = (row: PopupMarketRequest) => {
    setSelected(row);
    setAdminNotes(row.adminNotes ?? "");
    setNotesSaved(false);
    setPanelOpen(true);
  };

  const handleStatusChange = async (newStatus: Status) => {
    if (!selected) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/admin/popup-market-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated: PopupMarketRequest = await res.json();
        setSelected(updated);
        fetchList();
        fetchCounts();
      }
    } finally {
      setStatusSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await fetch(`/api/admin/popup-market-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes }),
      });
      if (res.ok) {
        const updated: PopupMarketRequest = await res.json();
        setSelected(updated);
        setNotesSaved(true);
        fetchList();
      }
    } finally {
      setSavingNotes(false);
    }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-CA") : "—";

  const totalPages = listData ? Math.ceil(listData.total / LIMIT) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Pop-Up Market Requests</h1>
        <p className="text-muted-foreground mt-1">Manage incoming pop-up market event requests</p>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border",
              statusFilter === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
          >
            {tab.label}
            {counts[tab.key] != null && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold",
                  statusFilter === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !listData?.data.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">No requests found</p>
            <p className="text-sm text-muted-foreground">
              {statusFilter === "all"
                ? "No pop-up market requests yet."
                : `No ${STATUS_LABELS[statusFilter as Status]} requests.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider hidden md:table-cell">
                    Organization
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">
                    Event Location
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider hidden lg:table-cell">
                    Preferred Date
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider hidden lg:table-cell">
                    Event Type
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider hidden md:table-cell">
                    Submitted
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase text-xs tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listData.data.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleSelectRow(row)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {row.organization ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground max-w-[180px] truncate">
                      {row.eventLocation}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {fmtDate(row.preferredDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {row.eventType ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                          STATUS_BADGE[row.status]
                        )}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {listData && listData.total > LIMIT && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, listData.total)} of{" "}
            {listData.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Slide-Over */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="sm:max-w-xl p-0 flex flex-col">
          {selected && (
            <>
              <div className="p-6 border-b border-border shrink-0">
                <SheetHeader>
                  <SheetTitle className="text-xl font-serif pr-6">{selected.name}</SheetTitle>
                  <SheetDescription>
                    Submitted {fmtDate(selected.createdAt)} · Updated {fmtDate(selected.updatedAt)}
                  </SheetDescription>
                </SheetHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Contact */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Contact
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="font-semibold text-foreground">Name</dt>
                      <dd className="text-muted-foreground">{selected.name}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Email</dt>
                      <dd className="text-muted-foreground break-all">{selected.email}</dd>
                    </div>
                    {selected.phone && (
                      <div>
                        <dt className="font-semibold text-foreground">Phone</dt>
                        <dd className="text-muted-foreground">{selected.phone}</dd>
                      </div>
                    )}
                    {selected.organization && (
                      <div>
                        <dt className="font-semibold text-foreground">Organization</dt>
                        <dd className="text-muted-foreground">{selected.organization}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                {/* Event Details */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Event Details
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="col-span-2">
                      <dt className="font-semibold text-foreground">Location</dt>
                      <dd className="text-muted-foreground">{selected.eventLocation}</dd>
                    </div>
                    {selected.preferredDate && (
                      <div>
                        <dt className="font-semibold text-foreground">Preferred Date</dt>
                        <dd className="text-muted-foreground">{selected.preferredDate}</dd>
                      </div>
                    )}
                    {selected.alternateDate && (
                      <div>
                        <dt className="font-semibold text-foreground">Alternate Date</dt>
                        <dd className="text-muted-foreground">{selected.alternateDate}</dd>
                      </div>
                    )}
                    {selected.estimatedAttendees && (
                      <div>
                        <dt className="font-semibold text-foreground">Attendees</dt>
                        <dd className="text-muted-foreground">{selected.estimatedAttendees}</dd>
                      </div>
                    )}
                    {selected.eventType && (
                      <div>
                        <dt className="font-semibold text-foreground">Event Type</dt>
                        <dd className="text-muted-foreground">{selected.eventType}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                {/* Products */}
                {selected.productsInterested.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Products Interested In
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selected.productsInterested.map((p) => (
                        <span
                          key={p}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Requester Notes */}
                {selected.notes && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Notes from Requester
                    </h3>
                    <p className="text-sm text-foreground bg-muted/50 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                      {selected.notes}
                    </p>
                  </section>
                )}

                {/* Status */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Status
                  </h3>
                  <div className="flex items-center gap-3">
                    <select
                      value={selected.status}
                      onChange={(e) => handleStatusChange(e.target.value as Status)}
                      disabled={statusSaving}
                      className="px-3 py-2 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm disabled:opacity-50"
                    >
                      <option value="new">New</option>
                      <option value="in_review">In Review</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="declined">Declined</option>
                    </select>
                    {statusSaving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                        STATUS_BADGE[selected.status]
                      )}
                    >
                      {STATUS_LABELS[selected.status]}
                    </span>
                  </div>
                </section>

                {/* Admin Notes */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Admin Notes
                  </h3>
                  <textarea
                    rows={4}
                    value={adminNotes}
                    onChange={(e) => {
                      setAdminNotes(e.target.value);
                      setNotesSaved(false);
                    }}
                    placeholder="Internal notes visible only to admins…"
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm"
                  />
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      {savingNotes && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Notes
                    </button>
                    {notesSaved && (
                      <span className="text-sm text-green-600 font-medium">Saved!</span>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
