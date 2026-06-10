import { Link, createFileRoute } from "@tanstack/react-router"
import { Calendar, ChevronRight, Clock, MapPin, Tag } from "lucide-react"
import { getItineraryRollupFn } from "@/server/travel/fns.overview"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/travel/itinerary")({
  loader: () => getItineraryRollupFn(),
  component: ItineraryPage,
})

// "OTHER" is not a valid ISO currency code for Intl — fall back to USD style.
function money(amount: number, currency: string): string {
  return formatCurrency(amount, currency === "OTHER" ? "USD" : currency)
}

function ItineraryPage() {
  const trips = Route.useLoaderData()

  const totalDays = trips.reduce((sum, t) => sum + t.days.length, 0)
  const totalActivities = trips.reduce(
    (sum, t) => sum + t.days.reduce((s, d) => s + d.activities.length, 0),
    0
  )
  const todayStr = toDateInputValue(new Date())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Itinerary</h1>
        <p className="text-sm text-muted-foreground">
          {totalDays} day{totalDays !== 1 ? "s" : ""} · {totalActivities}{" "}
          activit{totalActivities !== 1 ? "ies" : "y"} across {trips.length}{" "}
          trip{trips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No itinerary days yet. Add them from a trip&apos;s detail page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {trips.map((trip) => (
            <div key={trip.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <Link
                  to="/travel/trips/$id"
                  params={{ id: trip.id }}
                  search={{ tab: "itinerary" }}
                  className="group flex items-center gap-1.5"
                >
                  <h2 className="text-base font-semibold transition-colors group-hover:text-primary">
                    {trip.name}
                  </h2>
                  <ChevronRight className="size-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                </Link>
                <span className="text-xs text-muted-foreground">
                  {trip.days.length} day{trip.days.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3">
                {trip.days.map((day) => {
                  const isPast = day.date < todayStr
                  const isToday = day.date === todayStr

                  return (
                    <div
                      key={day.id}
                      className={`overflow-hidden rounded-lg border ${
                        isToday
                          ? "border-primary/40 ring-1 ring-primary/20"
                          : isPast
                            ? "border-border/30 opacity-70"
                            : "border-border/40"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between border-b px-4 py-2.5 ${
                          isToday
                            ? "border-primary/20 bg-primary/5"
                            : "border-border/30 bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar
                            className={`size-3.5 ${isToday ? "text-primary" : "text-muted-foreground"}`}
                          />
                          <span
                            className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}
                          >
                            {formatDate(day.date)}
                            {isToday && (
                              <span className="ml-2 text-xs font-normal text-primary/80">
                                Today
                              </span>
                            )}
                          </span>
                          {day.title && (
                            <span className="text-xs text-muted-foreground">
                              — {day.title}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {day.activities.length} activit
                          {day.activities.length !== 1 ? "ies" : "y"}
                        </span>
                      </div>

                      {day.notes && (
                        <div className="border-b border-border/20 bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
                          {day.notes}
                        </div>
                      )}

                      {day.activities.length > 0 ? (
                        <div className="divide-y divide-border/20">
                          {day.activities.map((act) => (
                            <div
                              key={act.id}
                              className="flex items-start gap-3 px-4 py-3"
                            >
                              <div className="mt-0.5 shrink-0">
                                {act.startTime ? (
                                  <div className="text-center">
                                    <p className="text-xs font-medium tabular-nums">
                                      {act.startTime}
                                    </p>
                                    {act.endTime && (
                                      <p className="text-[10px] text-muted-foreground tabular-nums">
                                        {act.endTime}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <Clock className="mt-0.5 size-3.5 text-muted-foreground/40" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-sm font-medium">
                                  {act.title}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  {act.location && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <MapPin className="size-2.5" />
                                      {act.location}
                                    </span>
                                  )}
                                  {act.bookingRef && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Tag className="size-2.5" />
                                      {act.bookingRef}
                                    </span>
                                  )}
                                </div>
                                {act.notes && (
                                  <p className="text-xs text-muted-foreground">
                                    {act.notes}
                                  </p>
                                )}
                              </div>
                              {act.cost !== null && (
                                <div className="shrink-0 text-right text-xs font-medium">
                                  {money(act.cost, act.currency)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                          No activities planned
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
