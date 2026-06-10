import { useState } from "react"
import {
  Car,
  ChevronRight,
  Hotel,
  MapPin,
  Plane,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react"
import type {
  ReservationRow,
  ReservationStatus,
  ReservationType,
} from "@/server/travel/detail"
import {
  createReservationFn,
  deleteReservationFn,
} from "@/server/travel/fns.detail"
import { formatCurrency, formatDate } from "@/lib/format"
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
  CURRENCIES,
  RESERVATION_TYPES,
  TRANSPORT_TYPES,
  displayCurrency,
  enumLabel,
  parseMoney,
  selectClass,
} from "./trip-shared"

function reservationIcon(type: ReservationType) {
  switch (type) {
    case "FLIGHT":
      return <Plane className="size-4" />
    case "HOTEL":
      return <Hotel className="size-4" />
    case "CAR_RENTAL":
      return <Car className="size-4" />
    case "RESTAURANT":
      return <UtensilsCrossed className="size-4" />
    default:
      return <MapPin className="size-4" />
  }
}

function reservationStatusVariant(
  status: ReservationStatus
): "default" | "secondary" | "destructive" {
  if (status === "CONFIRMED") return "default"
  if (status === "CANCELLED") return "destructive"
  return "secondary"
}

export function TripReservationsTab({
  tripId,
  reservations,
  onChanged,
}: {
  tripId: string
  reservations: Array<ReservationRow>
  onChanged: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function remove(reservationId: string) {
    setActionError(null)
    try {
      const result = await deleteReservationFn({ data: { id: reservationId } })
      if ("error" in result && typeof result.error === "string") {
        setActionError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setActionError("Could not delete reservation.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Reservations ({reservations.length})
        </h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" /> Add reservation
        </Button>
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {reservations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No reservations yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const isTransport = TRANSPORT_TYPES.includes(res.type)
            return (
              <Card key={res.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {reservationIcon(res.type)}
                        <span className="font-medium">{res.providerName}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {enumLabel(res.type)}
                        </Badge>
                        <Badge
                          variant={reservationStatusVariant(res.status)}
                          className="text-xs capitalize"
                        >
                          {enumLabel(res.status)}
                        </Badge>
                      </div>
                      {isTransport &&
                        (res.departureLocation || res.arrivalLocation) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{res.departureLocation}</span>
                            <ChevronRight className="size-3" />
                            <span>{res.arrivalLocation}</span>
                          </div>
                        )}
                      {!isTransport && res.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-3" /> {res.location}
                        </div>
                      )}
                      {(res.startDateTime || res.endDateTime) && (
                        <div className="text-xs text-muted-foreground">
                          {res.startDateTime && formatDate(res.startDateTime)}
                          {res.endDateTime &&
                            ` – ${formatDate(res.endDateTime)}`}
                        </div>
                      )}
                      {res.confirmationNumber && (
                        <div className="text-xs text-muted-foreground">
                          Conf: {res.confirmationNumber}
                        </div>
                      )}
                      {res.cost !== null && (
                        <div className="text-sm font-medium">
                          {formatCurrency(
                            res.cost,
                            displayCurrency(res.currency)
                          )}
                          {res.isPaid && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Paid
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete reservation"
                      onClick={() => remove(res.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {addOpen && (
        <AddReservationDialog
          tripId={tripId}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function AddReservationDialog({
  tripId,
  onClose,
  onSaved,
}: {
  tripId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<ReservationType>("FLIGHT")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const isTransport = TRANSPORT_TYPES.includes(type)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createReservationFn({
        data: {
          tripId,
          type,
          providerName: String(f.get("providerName") ?? ""),
          confirmationNumber: String(f.get("confirmationNumber") ?? ""),
          startDateTime: String(f.get("startDateTime") ?? ""),
          endDateTime: String(f.get("endDateTime") ?? ""),
          location: String(f.get("location") ?? ""),
          departureLocation: String(f.get("departureLocation") ?? ""),
          arrivalLocation: String(f.get("arrivalLocation") ?? ""),
          cost: parseMoney(f.get("cost")),
          currency: CURRENCIES.find((c) => c === f.get("currency")) ?? "USD",
          bookingUrl: String(f.get("bookingUrl") ?? ""),
          contactPhone: String(f.get("contactPhone") ?? ""),
          contactEmail: String(f.get("contactEmail") ?? ""),
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
      setError("Could not add reservation.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add reservation</DialogTitle>
          <DialogDescription>
            New reservations start as pending until confirmed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="res-type">Type *</Label>
            <select
              id="res-type"
              className={selectClass}
              value={type}
              onChange={(e) => {
                const next = RESERVATION_TYPES.find((t) => t === e.target.value)
                if (next) setType(next)
              }}
            >
              {RESERVATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-provider">Provider name *</Label>
            <Input
              id="res-provider"
              name="providerName"
              required
              placeholder={isTransport ? "Airline / Rail Co." : "Hotel / Venue"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-confirm">Confirmation number</Label>
            <Input id="res-confirm" name="confirmationNumber" />
          </div>

          {isTransport ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="res-dep">Departure location</Label>
                <Input id="res-dep" name="departureLocation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-arr">Arrival location</Label>
                <Input id="res-arr" name="arrivalLocation" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="res-start">Departure</Label>
                  <Input
                    id="res-start"
                    name="startDateTime"
                    type="datetime-local"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="res-end">Arrival</Label>
                  <Input
                    id="res-end"
                    name="endDateTime"
                    type="datetime-local"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="res-loc">Location</Label>
                <Input id="res-loc" name="location" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="res-checkin">
                    {type === "HOTEL" ? "Check-in" : "Start"}
                  </Label>
                  <Input
                    id="res-checkin"
                    name="startDateTime"
                    type="datetime-local"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="res-checkout">
                    {type === "HOTEL" ? "Check-out" : "End"}
                  </Label>
                  <Input
                    id="res-checkout"
                    name="endDateTime"
                    type="datetime-local"
                  />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="res-cost">Cost</Label>
              <Input
                id="res-cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-currency">Currency</Label>
              <select
                id="res-currency"
                name="currency"
                className={selectClass}
                defaultValue="USD"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-url">Booking URL</Label>
            <Input id="res-url" name="bookingUrl" type="url" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="res-phone">Contact phone</Label>
              <Input id="res-phone" name="contactPhone" type="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-email">Contact email</Label>
              <Input id="res-email" name="contactEmail" type="email" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-notes">Notes</Label>
            <Textarea id="res-notes" name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add reservation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
