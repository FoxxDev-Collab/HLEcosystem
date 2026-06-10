import { Link, createFileRoute } from "@tanstack/react-router"
import {
  Calendar,
  CheckSquare,
  DollarSign,
  FileText,
  MapPin,
  Package,
  Plane,
  Tag,
} from "lucide-react"
import { getTravelDashboardFn } from "@/server/travel/fns.overview"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export const Route = createFileRoute("/_authed/travel/dashboard")({
  loader: () => getTravelDashboardFn(),
  component: TravelDashboardPage,
})

// Days from today to a DATE string ("YYYY-MM-DD"), parsed as local time.
function daysUntil(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function TravelDashboardPage() {
  const {
    activeTrip,
    todayItinerary,
    upcomingTrips,
    expiringDocuments,
    totalTrips,
    totalDocuments,
  } = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your trips, packing progress, and document expirations at a glance.
        </p>
      </div>

      {activeTrip &&
        (() => {
          const packedPct =
            activeTrip.totalItems > 0
              ? Math.round(
                  (activeTrip.packedItems / activeTrip.totalItems) * 100
                )
              : 0
          const budgetPct =
            activeTrip.plannedTotal > 0
              ? Math.min(
                  Math.round(
                    (activeTrip.actualTotal / activeTrip.plannedTotal) * 100
                  ),
                  100
                )
              : 0
          const overBudget = activeTrip.actualTotal > activeTrip.plannedTotal
          const daysLeft = daysUntil(activeTrip.endDate)

          return (
            <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge>Currently Traveling</Badge>
                      <span className="text-xs text-muted-foreground">
                        {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                      </span>
                    </div>
                    <h2 className="text-xl font-bold">{activeTrip.name}</h2>
                    {activeTrip.destination && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {activeTrip.destination}
                      </div>
                    )}
                  </div>
                  <Link
                    to="/travel/trips/$id"
                    params={{ id: activeTrip.id }}
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    View trip →
                  </Link>
                </div>

                {todayItinerary && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Today
                      {todayItinerary.title ? ` — ${todayItinerary.title}` : ""}
                    </p>
                    {todayItinerary.activities.length > 0 ? (
                      <div className="space-y-1.5">
                        {todayItinerary.activities.map((act) => (
                          <div
                            key={act.id}
                            className="flex items-center gap-3 text-sm"
                          >
                            <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">
                              {act.startTime ?? "—"}
                            </span>
                            <span className="font-medium">{act.title}</span>
                            {act.location && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <MapPin className="size-2.5" />
                                {act.location}
                              </span>
                            )}
                            {act.bookingRef && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <Tag className="size-2.5" />
                                {act.bookingRef}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No activities scheduled for today
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 border-t border-primary/15 pt-2">
                  {activeTrip.totalItems > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Package className="size-3" /> Packing
                      </div>
                      <Progress value={packedPct} />
                      <p className="text-[10px] text-muted-foreground">
                        {activeTrip.packedItems}/{activeTrip.totalItems} packed
                      </p>
                    </div>
                  )}
                  {activeTrip.plannedTotal > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <DollarSign className="size-3" /> Budget
                      </div>
                      <Progress
                        value={budgetPct}
                        className={
                          overBudget
                            ? "[&_[data-slot=progress-indicator]]:bg-destructive"
                            : ""
                        }
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(activeTrip.actualTotal)} of{" "}
                        {formatCurrency(activeTrip.plannedTotal)}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" /> Dates
                    </div>
                    <p className="text-xs font-medium">
                      {formatDate(activeTrip.startDate)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      to {formatDate(activeTrip.endDate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })()}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
            <Plane className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTrips}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <MapPin className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingTrips.length}</div>
            <p className="text-xs text-muted-foreground">trips planned</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Travel Documents
            </CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocuments}</div>
          </CardContent>
        </Card>
      </div>

      {upcomingTrips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Trips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTrips.map((trip) => {
                const days = daysUntil(trip.startDate)
                return (
                  <Link
                    key={trip.id}
                    to="/travel/trips/$id"
                    params={{ id: trip.id }}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{trip.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {trip.destination && `${trip.destination} · `}
                        {formatDate(trip.startDate)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {trip.totalItems > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckSquare className="size-3" />
                          {trip.packedItems}/{trip.totalItems}
                        </span>
                      )}
                      {trip.reservationCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {trip.reservationCount} res.
                        </span>
                      )}
                      {days >= 0 && (
                        <Badge variant={days <= 7 ? "default" : "secondary"}>
                          {days === 0 ? "Today" : `${days}d`}
                        </Badge>
                      )}
                      <Badge variant="outline" className="capitalize">
                        {trip.status.toLowerCase().replace("_", " ")}
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {expiringDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" /> Expiring Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringDocuments.map((doc) => {
                const days = daysUntil(doc.expiryDate)
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {doc.type.replace(/_/g, " ")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {doc.displayName && `${doc.displayName} · `}
                        Expires {formatDate(doc.expiryDate)}
                      </div>
                    </div>
                    <Badge variant={days <= 30 ? "destructive" : "secondary"}>
                      {days}d left
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!activeTrip && upcomingTrips.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Plane className="mx-auto mb-4 size-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-medium">No trips planned</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Start planning your next adventure!
            </p>
            <Button render={<Link to="/travel/trips" />}>Plan a Trip</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
