import { useState } from "react"
import { Calendar, MapPin, Pencil, Trash2, UserPlus, Users } from "lucide-react"
import type { TripRow, TripStatus } from "@/server/travel/trips"
import type { TravelerRow } from "@/server/travel/detail"
import { addTravelerFn, removeTravelerFn } from "@/server/travel/fns.detail"
import {
  deleteTripFn,
  updateTripFn,
  updateTripStatusFn,
} from "@/server/travel/fns.trips"
import { Badge } from "@/components/ui/badge"
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
import {
  ConfirmDeleteDialog,
  TRIP_STATUSES,
  enumLabel,
  formatDateRange,
  selectClass,
  statusVariant,
} from "./trip-shared"

export type MemberOption = { membershipId: string; displayName: string }

export function TripOverviewTab({
  trip,
  travelers,
  members,
  onChanged,
  onDeleted,
}: {
  trip: TripRow
  travelers: Array<TravelerRow>
  members: Array<MemberOption>
  onChanged: () => void
  onDeleted: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addTravelerOpen, setAddTravelerOpen] = useState(false)
  const [statusPending, setStatusPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const availableMembers = members.filter(
    (m) => !travelers.some((t) => t.householdMemberId === m.membershipId)
  )

  async function changeStatus(status: TripStatus) {
    if (status === trip.status) return
    setActionError(null)
    setStatusPending(true)
    try {
      const result = await updateTripStatusFn({
        data: { tripId: trip.id, status },
      })
      if ("error" in result && typeof result.error === "string") {
        setActionError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setActionError("Could not update trip status.")
    }
    setStatusPending(false)
  }

  async function removeTraveler(travelerId: string) {
    setActionError(null)
    try {
      const result = await removeTravelerFn({ data: { id: travelerId } })
      if ("error" in result && typeof result.error === "string") {
        setActionError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setActionError("Could not remove traveler.")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Trip details</CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={statusVariant(trip.status)}
                className="capitalize"
              >
                {enumLabel(trip.status)}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {trip.destination && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{trip.destination}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
          </div>
          {trip.description && (
            <p className="text-sm text-muted-foreground">{trip.description}</p>
          )}
          {trip.notes && (
            <div className="rounded-md bg-muted p-3 text-sm">{trip.notes}</div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Label className="text-sm">Change status:</Label>
            <div className="flex flex-wrap gap-1">
              {TRIP_STATUSES.map((s) => (
                <Button
                  key={s}
                  variant={trip.status === s ? "default" : "outline"}
                  size="sm"
                  className="text-xs capitalize"
                  disabled={statusPending}
                  onClick={() => changeStatus(s)}
                >
                  {enumLabel(s)}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" /> Delete trip
            </Button>
          </div>
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Travelers ({travelers.length})
            </CardTitle>
            {availableMembers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddTravelerOpen(true)}
              >
                <UserPlus className="size-3.5" /> Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {travelers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No travelers added yet.
            </p>
          ) : (
            <div className="space-y-2">
              {travelers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <span className="text-sm font-medium">{t.displayName}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remove traveler"
                    onClick={() => removeTraveler(t.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editOpen && (
        <EditTripDialog
          trip={trip}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            onChanged()
          }}
        />
      )}
      {addTravelerOpen && (
        <AddTravelerDialog
          tripId={trip.id}
          members={availableMembers}
          onClose={() => setAddTravelerOpen(false)}
          onSaved={() => {
            setAddTravelerOpen(false)
            onChanged()
          }}
        />
      )}
      {deleteOpen && (
        <ConfirmDeleteDialog
          title={`Delete ${trip.name}?`}
          description="The trip and all of its itinerary, reservations, packing lists, budget, and contacts will be permanently removed."
          onConfirm={() => deleteTripFn({ data: { id: trip.id } })}
          onClose={() => setDeleteOpen(false)}
          onDone={onDeleted}
        />
      )}
    </div>
  )
}

function EditTripDialog({
  trip,
  onClose,
  onSaved,
}: {
  trip: TripRow
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
      const result = await updateTripFn({
        data: {
          tripId: trip.id,
          name: String(f.get("name") ?? ""),
          destination: String(f.get("destination") ?? ""),
          startDate: String(f.get("startDate") ?? ""),
          endDate: String(f.get("endDate") ?? ""),
          description: String(f.get("description") ?? ""),
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
      setError("Could not update trip.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit trip</DialogTitle>
          <DialogDescription>
            Update the trip details. Dates use the trip&apos;s local calendar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={trip.name}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-dest">Destination</Label>
            <Input
              id="edit-dest"
              name="destination"
              defaultValue={trip.destination ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start">Start date *</Label>
              <Input
                id="edit-start"
                name="startDate"
                type="date"
                defaultValue={trip.startDate}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">End date *</Label>
              <Input
                id="edit-end"
                name="endDate"
                type="date"
                defaultValue={trip.endDate}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              name="description"
              defaultValue={trip.description ?? ""}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              name="notes"
              defaultValue={trip.notes ?? ""}
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddTravelerDialog({
  tripId,
  members,
  onClose,
  onSaved,
}: {
  tripId: string
  members: Array<MemberOption>
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
      const result = await addTravelerFn({
        data: {
          tripId,
          householdMemberId: String(f.get("householdMemberId") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add traveler.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add traveler</DialogTitle>
          <DialogDescription>
            Pick a household member to add to this trip.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="traveler-member">Household member</Label>
            <select
              id="traveler-member"
              name="householdMemberId"
              className={selectClass}
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select member
              </option>
              {members.map((m) => (
                <option key={m.membershipId} value={m.membershipId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add traveler"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
