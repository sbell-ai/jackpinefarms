import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  useAdminListPickupEvents,
  getAdminListPickupEventsQueryKey,
  useAdminCreatePickupEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarDays, ChevronRight } from "lucide-react";
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
        qc.invalidateQueries({ queryKey: getAdminListPickupEventsQueryKey() });
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  function handleSubmit() {
    if (!name || !scheduledAt) return;
    createEvent.mutate({
      data: {
        name,
        scheduledAt,
        locationNotes: locationNotes || null,
      },
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
            <Link key={event.id} href={`/admin/pickup-events/${event.id}`}>
              <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{event.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[event.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {event.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {event.assignedOrderCount} order{event.assignedOrderCount !== 1 ? "s" : ""} assigned
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {format(new Date(event.scheduledAt), "EEEE, MMM d, yyyy h:mm a")}
                  </div>
                  {event.locationNotes && (
                    <div className="text-xs text-muted-foreground mt-0.5 italic">{event.locationNotes}</div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </div>
            </Link>
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
