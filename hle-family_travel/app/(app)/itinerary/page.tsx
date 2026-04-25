import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, MapPin, ChevronRight, Tag } from "lucide-react";

export default async function ItineraryPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) notFound();

  const trips = await prisma.trip.findMany({
    where: { householdId, itineraryDays: { some: {} } },
    orderBy: { startDate: "asc" },
    include: {
      itineraryDays: {
        orderBy: { date: "asc" },
        include: {
          activities: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  const totalDays = trips.reduce((sum, t) => sum + t.itineraryDays.length, 0);
  const totalActivities = trips.reduce(
    (sum, t) => sum + t.itineraryDays.reduce((s, d) => s + d.activities.length, 0),
    0
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Itinerary</h1>
        <p className="text-muted-foreground">
          {totalDays} day{totalDays !== 1 ? "s" : ""} · {totalActivities} activit{totalActivities !== 1 ? "ies" : "y"} across {trips.length} trip{trips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No itinerary days yet. Add them from a trip&apos;s detail page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {trips.map((trip) => (
            <div key={trip.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <Link href={`/trips/${trip.id}?tab=itinerary`} className="group flex items-center gap-1.5">
                  <h2 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{trip.name}</h2>
                  <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </Link>
                <span className="text-xs text-muted-foreground">{trip.itineraryDays.length} day{trip.itineraryDays.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="space-y-3">
                {trip.itineraryDays.map((day) => {
                  const dayDate = new Date(day.date);
                  dayDate.setHours(0, 0, 0, 0);
                  const isPast = dayDate < today;
                  const isToday = dayDate.getTime() === today.getTime();

                  return (
                    <div
                      key={day.id}
                      className={`rounded-lg border overflow-hidden ${
                        isToday
                          ? "border-primary/40 ring-1 ring-primary/20"
                          : isPast
                          ? "border-border/30 opacity-70"
                          : "border-border/40"
                      }`}
                    >
                      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                        isToday ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/30"
                      }`}>
                        <div className="flex items-center gap-2">
                          <Calendar className={`size-3.5 ${isToday ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                            {formatDate(day.date)}
                            {isToday && <span className="ml-2 text-xs font-normal text-primary/80">Today</span>}
                          </span>
                          {day.title && (
                            <span className="text-xs text-muted-foreground">— {day.title}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{day.activities.length} activit{day.activities.length !== 1 ? "ies" : "y"}</span>
                      </div>

                      {day.notes && (
                        <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/10 border-b border-border/20">
                          {day.notes}
                        </div>
                      )}

                      {day.activities.length > 0 ? (
                        <div className="divide-y divide-border/20">
                          {day.activities.map((act) => (
                            <div key={act.id} className="flex items-start gap-3 px-4 py-3">
                              <div className="shrink-0 mt-0.5">
                                {act.startTime ? (
                                  <div className="text-center">
                                    <p className="text-xs font-medium tabular-nums">{act.startTime}</p>
                                    {act.endTime && (
                                      <p className="text-[10px] text-muted-foreground tabular-nums">{act.endTime}</p>
                                    )}
                                  </div>
                                ) : (
                                  <Clock className="size-3.5 text-muted-foreground/40 mt-0.5" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <p className="text-sm font-medium">{act.title}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  {act.location && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <MapPin className="size-2.5" />{act.location}
                                    </span>
                                  )}
                                  {act.bookingRef && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Tag className="size-2.5" />{act.bookingRef}
                                    </span>
                                  )}
                                </div>
                                {act.notes && (
                                  <p className="text-xs text-muted-foreground">{act.notes}</p>
                                )}
                              </div>
                              {act.cost !== null && (
                                <div className="shrink-0 text-xs font-medium text-right">
                                  {formatCurrency(act.cost, act.currency)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-xs text-muted-foreground text-center">No activities planned</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
