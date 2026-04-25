import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plane, FileText, MapPin, Calendar, Clock, Tag,
  Package, DollarSign, CheckSquare,
} from "lucide-react";
import Link from "next/link";
import { formatDate, formatCurrency, daysUntil } from "@/lib/format";
import { TripStatusSync } from "@/components/trip-status-sync";

function getExpiryWindow() {
  const now = new Date();
  return { gte: now, lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) };
}

export default async function DashboardPage() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryWindow = getExpiryWindow();

  const [activeTrip, upcomingTrips, expiringDocs, totalTrips, totalDocs] = await Promise.all([
    // Trip happening right now
    prisma.trip.findFirst({
      where: {
        householdId,
        status: "IN_PROGRESS",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        travelers: true,
        packingLists: { include: { items: true } },
        budgetItems: true,
        itineraryDays: {
          where: { date: today },
          include: { activities: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    // Upcoming trips (PLANNING or BOOKED, not yet started)
    prisma.trip.findMany({
      where: {
        householdId,
        status: { in: ["PLANNING", "BOOKED"] },
        startDate: { gt: today },
      },
      orderBy: { startDate: "asc" },
      include: {
        travelers: true,
        packingLists: { include: { items: true } },
        _count: { select: { reservations: true } },
      },
      take: 5,
    }),
    prisma.travelDocument.findMany({
      where: { householdId, expiryDate: expiryWindow },
      orderBy: { expiryDate: "asc" },
      take: 5,
    }),
    prisma.trip.count({ where: { householdId } }),
    prisma.travelDocument.count({ where: { householdId } }),
  ]);

  return (
    <div className="space-y-6">
      <TripStatusSync />
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Active trip hero */}
      {activeTrip && (() => {
        const packedItems = activeTrip.packingLists.flatMap((l) => l.items);
        const packedCount = packedItems.filter((i) => i.isPacked).length;
        const totalItems = packedItems.length;
        const planned = activeTrip.budgetItems.reduce((s, b) => s + Number(b.plannedAmount), 0);
        const actual = activeTrip.budgetItems.reduce((s, b) => s + (b.actualAmount ? Number(b.actualAmount) : 0), 0);
        const todayDay = activeTrip.itineraryDays[0];
        const tripEnd = new Date(activeTrip.endDate);
        const daysLeft = Math.ceil((tripEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return (
          <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default" className="text-[10px]">Currently Traveling</Badge>
                    <span className="text-xs text-muted-foreground">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</span>
                  </div>
                  <h2 className="text-xl font-bold">{activeTrip.name}</h2>
                  {activeTrip.destination && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="size-3.5" />{activeTrip.destination}
                    </div>
                  )}
                </div>
                <Link href={`/trips/${activeTrip.id}`} className="text-xs text-primary hover:underline shrink-0">
                  View trip →
                </Link>
              </div>

              {/* Today's itinerary */}
              {todayDay && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Today{todayDay.title ? ` — ${todayDay.title}` : ""}
                  </p>
                  {todayDay.activities.length > 0 ? (
                    <div className="space-y-1.5">
                      {todayDay.activities.map((act) => (
                        <div key={act.id} className="flex items-center gap-3 text-sm">
                          <span className="text-xs text-muted-foreground shrink-0 w-10 tabular-nums">
                            {act.startTime ?? "—"}
                          </span>
                          <span className="font-medium">{act.title}</span>
                          {act.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="size-2.5" />{act.location}
                            </span>
                          )}
                          {act.bookingRef && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Tag className="size-2.5" />{act.bookingRef}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No activities scheduled for today</p>
                  )}
                </div>
              )}

              {/* Trip stats */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-primary/15">
                {totalItems > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="size-3" /> Packing
                    </div>
                    <Progress value={Math.round((packedCount / totalItems) * 100)} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">{packedCount}/{totalItems} packed</p>
                  </div>
                )}
                {planned > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <DollarSign className="size-3" /> Budget
                    </div>
                    <Progress
                      value={Math.min(Math.round((actual / planned) * 100), 100)}
                      className={`h-1.5 ${actual > planned ? "[&>div]:bg-destructive" : ""}`}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {formatCurrency(actual)} of {formatCurrency(planned)}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3" /> Dates
                  </div>
                  <p className="text-xs font-medium">{formatDate(activeTrip.startDate)}</p>
                  <p className="text-[10px] text-muted-foreground">to {formatDate(activeTrip.endDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Summary stat cards */}
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
            <CardTitle className="text-sm font-medium">Travel Documents</CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocs}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming trips */}
      {upcomingTrips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Trips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTrips.map((trip) => {
                const days = daysUntil(trip.startDate);
                const packedItems = trip.packingLists.flatMap((l) => l.items);
                const packedCount = packedItems.filter((i) => i.isPacked).length;
                const totalItems = packedItems.length;

                return (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{trip.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {trip.destination && `${trip.destination} · `}
                        {formatDate(trip.startDate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {totalItems > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckSquare className="size-3" />{packedCount}/{totalItems}
                        </span>
                      )}
                      {trip._count.reservations > 0 && (
                        <span className="text-xs text-muted-foreground">{trip._count.reservations} res.</span>
                      )}
                      {days !== null && days >= 0 && (
                        <Badge variant={days <= 7 ? "default" : "secondary"}>
                          {days === 0 ? "Today" : `${days}d`}
                        </Badge>
                      )}
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {trip.status.toLowerCase().replace("_", " ")}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiring documents */}
      {expiringDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" /> Expiring Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringDocs.map((doc) => {
                const days = daysUntil(doc.expiryDate);
                return (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{doc.type.replace(/_/g, " ")}</div>
                      <div className="text-sm text-muted-foreground">
                        {doc.displayName && `${doc.displayName} · `}
                        Expires {formatDate(doc.expiryDate)}
                      </div>
                    </div>
                    {days !== null && (
                      <Badge variant={days <= 30 ? "destructive" : "secondary"}>
                        {days}d left
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!activeTrip && upcomingTrips.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Plane className="mx-auto size-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No trips planned</h3>
            <p className="text-sm text-muted-foreground mb-4">Start planning your next adventure!</p>
            <Link
              href="/trips"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Plan a Trip
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
