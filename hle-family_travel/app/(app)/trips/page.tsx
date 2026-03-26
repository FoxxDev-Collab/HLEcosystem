import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, MapPin, Users, Calendar } from "lucide-react";
import Link from "next/link";
import { formatDateRange } from "@/lib/format";
import { TripFilters } from "@/components/trip-filters";
import { CreateTripDialog } from "@/components/create-trip-dialog";
import type { TripStatus } from "@prisma/client";

function statusColor(status: TripStatus) {
  switch (status) {
    case "PLANNING": return "secondary";
    case "BOOKED": return "default";
    case "IN_PROGRESS": return "default";
    case "COMPLETED": return "outline";
    case "CANCELLED": return "destructive";
  }
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  const params = await searchParams;
  const filterStatus = params.status as TripStatus | undefined;

  const validStatuses: TripStatus[] = ["PLANNING", "BOOKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  const statusFilter = filterStatus && validStatuses.includes(filterStatus) ? filterStatus : undefined;

  const trips = await prisma.trip.findMany({
    where: {
      householdId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { startDate: "desc" },
    include: {
      travelers: true,
      _count: { select: { reservations: true, budgetItems: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trips</h1>
        <CreateTripDialog />
      </div>

      <TripFilters activeStatus={statusFilter} />

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Plane className="mx-auto size-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {statusFilter ? "No trips with this status" : "No trips yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {statusFilter
                ? "Try a different filter or create a new trip."
                : "Start planning your next adventure!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg leading-tight">{trip.name}</h3>
                    <Badge variant={statusColor(trip.status)} className="shrink-0 capitalize">
                      {trip.status.toLowerCase().replace("_", " ")}
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

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
                    <div className="flex items-center gap-1">
                      <Users className="size-3" />
                      <span>{trip.travelers.length} traveler{trip.travelers.length !== 1 ? "s" : ""}</span>
                    </div>
                    {trip._count.reservations > 0 && (
                      <span>{trip._count.reservations} reservation{trip._count.reservations !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
