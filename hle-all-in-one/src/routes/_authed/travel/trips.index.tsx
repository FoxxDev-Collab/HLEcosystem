import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { Calendar, MapPin, Plane, Plus, Users } from "lucide-react"
import { createTripFn, listTripsFn } from "@/server/travel/fns.trips"
import type { TripStatus } from "@/server/travel/trips"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  TRIP_STATUSES,
  enumLabel,
  formatDateRange,
  statusVariant,
} from "@/components/travel/trip-shared"

type TripsSearch = { status?: TripStatus }

export const Route = createFileRoute("/_authed/travel/trips/")({
  validateSearch: (search: Record<string, unknown>): TripsSearch => {
    const status = TRIP_STATUSES.find((s) => s === search.status)
    return status ? { status } : {}
  },
  loaderDeps: ({ search }) => ({ status: search.status ?? null }),
  loader: ({ deps }) => listTripsFn({ data: { status: deps.status } }),
  component: TripsPage,
})

const FILTERS: Array<{ label: string; value: TripStatus | undefined }> = [
  { label: "All", value: undefined },
  { label: "Planning", value: "PLANNING" },
  { label: "Booked", value: "BOOKED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
]

function TripsPage() {
  const trips = Route.useLoaderData()
  const { status } = Route.useSearch()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Trips</h1>
          <p className="text-sm text-muted-foreground">
            Plan, book, and track your family&apos;s travel.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Create trip
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={status === f.value ? "default" : "outline"}
            size="sm"
            render={
              <Link
                to="/travel/trips"
                search={f.value ? { status: f.value } : {}}
              />
            }
          >
            {f.label}
          </Button>
        ))}
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Plane className="mx-auto mb-4 size-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-medium">
              {status ? "No trips with this status" : "No trips yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {status
                ? "Try a different filter or create a new trip."
                : "Start planning your next adventure!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Link key={trip.id} to="/travel/trips/$id" params={{ id: trip.id }}>
              <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg leading-tight font-semibold">
                      {trip.name}
                    </h3>
                    <Badge
                      variant={statusVariant(trip.status)}
                      className="shrink-0 capitalize"
                    >
                      {enumLabel(trip.status)}
                    </Badge>
                  </div>
                  {trip.destination && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      <span>{trip.destination}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="size-3.5" />
                    <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-4 border-t pt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="size-3" />
                      <span>
                        {trip.travelerCount} traveler
                        {trip.travelerCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {trip.reservationCount > 0 && (
                      <span>
                        {trip.reservationCount} reservation
                        {trip.reservationCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateTripDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function CreateTripDialog({
  onClose,
  onSaved,
}: {
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
      const result = await createTripFn({
        data: {
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
      setError("Could not create trip.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create trip</DialogTitle>
          <DialogDescription>
            New trips start in planning status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-name">Trip name *</Label>
            <Input id="trip-name" name="name" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trip-dest">Destination</Label>
            <Input id="trip-dest" name="destination" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trip-start">Start date *</Label>
              <Input id="trip-start" name="startDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-end">End date *</Label>
              <Input id="trip-end" name="endDate" type="date" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trip-desc">Description</Label>
            <Textarea id="trip-desc" name="description" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trip-notes">Notes</Label>
            <Textarea id="trip-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create trip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
