import { Link, createFileRoute } from "@tanstack/react-router"
import {
  Bus,
  Car,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  Hotel,
  MapPin,
  Package,
  Plane,
  Ship,
  Train,
  UtensilsCrossed,
  XCircle,
} from "lucide-react"
import { getReservationsRollupFn } from "@/server/travel/fns.overview"
import type {
  ReservationStatus,
  ReservationType,
} from "@/server/travel/overview"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/travel/reservations")({
  loader: () => getReservationsRollupFn(),
  component: ReservationsPage,
})

// "OTHER" is not a valid ISO currency code for Intl — fall back to USD style.
function money(amount: number, currency: string): string {
  return formatCurrency(amount, currency === "OTHER" ? "USD" : currency)
}

function typeIcon(type: ReservationType) {
  switch (type) {
    case "FLIGHT":
      return <Plane className="size-4" />
    case "HOTEL":
      return <Hotel className="size-4" />
    case "CAR_RENTAL":
      return <Car className="size-4" />
    case "RESTAURANT":
      return <UtensilsCrossed className="size-4" />
    case "TRAIN":
      return <Train className="size-4" />
    case "BUS":
      return <Bus className="size-4" />
    case "FERRY":
    case "CRUISE":
      return <Ship className="size-4" />
    default:
      return <MapPin className="size-4" />
  }
}

function typeLabel(type: ReservationType): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusBadge(status: ReservationStatus) {
  switch (status) {
    case "CONFIRMED":
      return (
        <Badge>
          <CheckCircle className="size-2.5" /> Confirmed
        </Badge>
      )
    case "PENDING":
      return (
        <Badge variant="secondary">
          <Clock className="size-2.5" /> Pending
        </Badge>
      )
    case "CANCELLED":
      return (
        <Badge variant="destructive">
          <XCircle className="size-2.5" /> Cancelled
        </Badge>
      )
    case "COMPLETED":
      return <Badge variant="outline">Completed</Badge>
  }
}

function ReservationsPage() {
  const trips = Route.useLoaderData()
  const totalReservations = trips.reduce(
    (sum, t) => sum + t.reservations.length,
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">All Reservations</h1>
        <p className="text-sm text-muted-foreground">
          {totalReservations} reservation{totalReservations !== 1 ? "s" : ""}{" "}
          across {trips.length} trip{trips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No reservations yet. Add them from a trip&apos;s detail page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {trips.map((trip) => (
            <div key={trip.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Link
                  to="/travel/trips/$id"
                  params={{ id: trip.id }}
                  search={{ tab: "reservations" }}
                  className="group flex items-center gap-1.5"
                >
                  <h2 className="text-sm font-semibold transition-colors group-hover:text-primary">
                    {trip.name}
                  </h2>
                  <ChevronRight className="size-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                </Link>
                <span className="text-xs text-muted-foreground">
                  {trip.reservations.length} reservation
                  {trip.reservations.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {trip.reservations.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-4 rounded-lg border border-border/40 bg-card p-3"
                  >
                    <div className="shrink-0 text-muted-foreground">
                      {typeIcon(r.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {r.providerName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {typeLabel(r.type)}
                        </span>
                        {r.confirmationNumber && (
                          <span className="font-mono text-xs text-muted-foreground">
                            #{r.confirmationNumber}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3">
                        {r.departureLocation && r.arrivalLocation ? (
                          <span className="text-xs text-muted-foreground">
                            {r.departureLocation} → {r.arrivalLocation}
                          </span>
                        ) : r.location ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-2.5" />
                            {r.location}
                          </span>
                        ) : null}
                        {r.startDateTime && (
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(r.startDateTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {statusBadge(r.status)}
                      {r.cost !== null && (
                        <span className="text-sm font-medium">
                          {money(r.cost, r.currency)}
                        </span>
                      )}
                      {r.isPaid && (
                        <Badge variant="outline" className="text-green-600">
                          Paid
                        </Badge>
                      )}
                      {r.bookingUrl && (
                        <a
                          href={r.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground transition-colors hover:text-primary"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
