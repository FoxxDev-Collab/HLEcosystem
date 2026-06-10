import { useState } from "react"
import { Clock, DollarSign, MapPin, Plus, Trash2 } from "lucide-react"
import type {
  ItineraryActivityRow,
  ItineraryDayWithActivities,
} from "@/server/travel/detail"
import {
  createItineraryActivityFn,
  createItineraryDayFn,
  deleteItineraryActivityFn,
  deleteItineraryDayFn,
} from "@/server/travel/fns.detail"
import { formatCurrency, formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteDialog, parseMoney } from "./trip-shared"

export function TripItineraryTab({
  tripId,
  startDate,
  endDate,
  days,
  onChanged,
}: {
  tripId: string
  startDate: string
  endDate: string
  days: Array<ItineraryDayWithActivities>
  onChanged: () => void
}) {
  const [addDayOpen, setAddDayOpen] = useState(false)
  const [addActivityDayId, setAddActivityDayId] = useState<string | null>(null)
  const [deleteDayTarget, setDeleteDayTarget] =
    useState<ItineraryDayWithActivities | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function removeActivity(activity: ItineraryActivityRow) {
    setActionError(null)
    try {
      const result = await deleteItineraryActivityFn({
        data: { id: activity.id },
      })
      if ("error" in result && typeof result.error === "string") {
        setActionError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setActionError("Could not delete activity.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Itinerary</h2>
        <Button size="sm" onClick={() => setAddDayOpen(true)}>
          <Plus className="size-3.5" /> Add day
        </Button>
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {days.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No itinerary days yet. Add a day to start planning.
          </CardContent>
        </Card>
      ) : (
        days.map((day) => (
          <Card key={day.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {formatDate(day.date)}
                    {day.title && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        — {day.title}
                      </span>
                    )}
                  </CardTitle>
                  {day.notes && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {day.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddActivityDayId(day.id)}
                  >
                    <Plus className="size-3.5" /> Activity
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete day"
                    onClick={() => setDeleteDayTarget(day)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {day.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activities planned.
                </p>
              ) : (
                <div className="space-y-2">
                  {day.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between rounded-md border p-3"
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">
                          {activity.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {(activity.startTime || activity.endTime) && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {activity.startTime}
                              {activity.endTime && ` – ${activity.endTime}`}
                            </span>
                          )}
                          {activity.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" /> {activity.location}
                            </span>
                          )}
                          {activity.cost !== null && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="size-3" />
                              {formatCurrency(activity.cost)}
                            </span>
                          )}
                          {activity.bookingRef && (
                            <span>Ref: {activity.bookingRef}</span>
                          )}
                        </div>
                        {activity.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {activity.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete activity"
                        onClick={() => removeActivity(activity)}
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {addDayOpen && (
        <AddDayDialog
          tripId={tripId}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setAddDayOpen(false)}
          onSaved={() => {
            setAddDayOpen(false)
            onChanged()
          }}
        />
      )}
      {addActivityDayId && (
        <AddActivityDialog
          dayId={addActivityDayId}
          onClose={() => setAddActivityDayId(null)}
          onSaved={() => {
            setAddActivityDayId(null)
            onChanged()
          }}
        />
      )}
      {deleteDayTarget && (
        <ConfirmDeleteDialog
          title={`Delete ${formatDate(deleteDayTarget.date)}?`}
          description={`The day and its ${deleteDayTarget.activities.length} activit${deleteDayTarget.activities.length === 1 ? "y" : "ies"} will be removed from the itinerary.`}
          onConfirm={() =>
            deleteItineraryDayFn({ data: { id: deleteDayTarget.id } })
          }
          onClose={() => setDeleteDayTarget(null)}
          onDone={() => {
            setDeleteDayTarget(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function AddDayDialog({
  tripId,
  startDate,
  endDate,
  onClose,
  onSaved,
}: {
  tripId: string
  startDate: string
  endDate: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createItineraryDayFn({
        data: {
          tripId,
          date: String(f.get("date") ?? ""),
          title: String(f.get("title") ?? ""),
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add day.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add itinerary day</DialogTitle>
          <DialogDescription>
            One entry per date — each trip date can only appear once.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="day-date">Date *</Label>
            <Input
              id="day-date"
              name="date"
              type="date"
              min={startDate}
              max={endDate}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="day-title">Title</Label>
            <Input
              id="day-title"
              name="title"
              placeholder="e.g., Arrival Day"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="day-notes">Notes</Label>
            <Textarea id="day-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add day"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddActivityDialog({
  dayId,
  onClose,
  onSaved,
}: {
  dayId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createItineraryActivityFn({
        data: {
          itineraryDayId: dayId,
          title: String(f.get("title") ?? ""),
          startTime: String(f.get("startTime") ?? ""),
          endTime: String(f.get("endTime") ?? ""),
          location: String(f.get("location") ?? ""),
          address: String(f.get("address") ?? ""),
          bookingRef: String(f.get("bookingRef") ?? ""),
          cost: parseMoney(f.get("cost")),
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add activity.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
          <DialogDescription>
            Plan something for this day of the trip.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="act-title">Title *</Label>
            <Input id="act-title" name="title" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="act-start">Start time</Label>
              <Input id="act-start" name="startTime" type="time" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-end">End time</Label>
              <Input id="act-end" name="endTime" type="time" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="act-location">Location</Label>
            <Input id="act-location" name="location" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="act-address">Address</Label>
            <Input id="act-address" name="address" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="act-ref">Booking ref</Label>
              <Input id="act-ref" name="bookingRef" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-cost">Cost</Label>
              <Input
                id="act-cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="act-notes">Notes</Label>
            <Textarea id="act-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
