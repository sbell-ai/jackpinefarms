import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  useAdminListPickupEvents,
  getAdminListPickupEventsQueryKey,
  useAdminCreatePickupEvent,
  useAdminUpdatePickupEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarDays, ChevronRight, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  completed: "bg-teal-100 text-teal-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminPickupEvents() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [capacity, setCapacity] = useState("");

  const { data: events = [], isLoading } = useAdminListPickupEvents({
    query: { queryKey: getAdminListPickupEventsQueryKey() },
  });

  const createEvent = useAdminCreatePickupEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Pickup event created" });
        setDialogOpen(false);
        setName("");
        setScheduledAt("");
        setLocationNotes("");
        setIsPublic(false);
        setCapacity("");
        qc.invalidateQueries({ queryKey: getAdminListPickupEventsQueryKey() });
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  const updateEvent = useAdminUpdatePickupEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getAdminListPickupEventsQueryKey() });
      },
      onError: (e: any) => toast({ title: "Error", description: e.response?.data?.error ?? e.message, variant: "destructive" }),
    },
  });

  function handleSubmit() {
    if (!name || !scheduledAt) return;
    createEvent.mutate({
      data: {
        name,
        scheduledAt,
        locationNotes: locationNotes || null,
        isPublic,
        capacity: capacity ? Number(capacity) : null,
      },
    });
  }

  function handleTogglePublic(event: any) {
    updateEvent.mutate({
      id: event.id,
      data: { isPublic: !event.isPublic },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pickup Events</h1>
          <p className="text-muted-foreground mt-1">{events.length} event{events.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Event
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No pickup events yet. Schedule one to coordinate order pickups.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event: any) => (
            <div key={event.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{event.name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[event.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {event.status}
                  </span>
                  {event.isPublic ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      <Globe className="w-3 h-3" /> Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      <Lock className="w-3 h-3" /> Draft
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {event.assignedOrderCount} order{event.assignedOrderCount !== 1 ? "s" : ""} assigned
                  </span>
                  {event.capacity != null && (
                    <span className="text-xs text-muted-foreground">
                      / {event.capacity} capacity
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {format(new Date(event.scheduledAt), "EEEE, MMM d, yyyy h:mm a")}
                </div>
                {event.locationNotes && (
                  <div className="text-xs text-muted-foreground mt-0.5 italic">{event.locationNotes}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant={event.isPublic ? "outline" : "default"}
                  onClick={() => handleTogglePublic(event)}
                >
                  {event.isPublic ? "Unpublish" : "Publish"}
                </Button>
                <Link href={`/admin/pickup-events/${event.id}`}>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Pickup Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Event Name</Label>
              <Input
                placeholder="e.g. Spring Pickup — Farm Gate"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Location Notes (optional)</Label>
              <Input
                placeholder="e.g. Meet at the barn, 123 Farm Rd"
                value={locationNotes}
                onChange={(e) => setLocationNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Capacity (optional)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Max number of orders"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="isPublic" className="cursor-pointer">
                Publish immediately (visible to customers at checkout)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={!name || !scheduledAt || createEvent.isPending} onClick={handleSubmit}>
              {createEvent.isPending ? "Creating…" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
