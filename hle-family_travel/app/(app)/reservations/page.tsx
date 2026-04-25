import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plane, Hotel, Car, UtensilsCrossed, MapPin, Train, Bus, Ship,
  Package, CheckCircle, Clock, XCircle, ExternalLink, ChevronRight,
} from "lucide-react";
import type { ReservationType, ReservationStatus } from "@prisma/client";

function typeIcon(type: ReservationType) {
  switch (type) {
    case "FLIGHT":      return <Plane className="size-4" />;
    case "HOTEL":       return <Hotel className="size-4" />;
    case "CAR_RENTAL":  return <Car className="size-4" />;
    case "RESTAURANT":  return <UtensilsCrossed className="size-4" />;
    case "TRAIN":       return <Train className="size-4" />;
    case "BUS":         return <Bus className="size-4" />;
    case "FERRY":
    case "CRUISE":      return <Ship className="size-4" />;
    default:            return <MapPin className="size-4" />;
  }
}

function typeLabel(type: ReservationType): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status: ReservationStatus) {
  switch (status) {
    case "CONFIRMED": return <Badge variant="default" className="text-[10px]"><CheckCircle className="size-2.5 mr-1" />Confirmed</Badge>;
    case "PENDING":   return <Badge variant="secondary" className="text-[10px]"><Clock className="size-2.5 mr-1" />Pending</Badge>;
    case "CANCELLED": return <Badge variant="destructive" className="text-[10px]"><XCircle className="size-2.5 mr-1" />Cancelled</Badge>;
    case "COMPLETED": return <Badge variant="outline" className="text-[10px]">Completed</Badge>;
    default:          return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

export default async function ReservationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) notFound();

  const trips = await prisma.trip.findMany({
    where: { householdId, reservations: { some: {} } },
    orderBy: { startDate: "asc" },
    include: {
      reservations: { orderBy: { startDateTime: "asc" } },
    },
  });

  const totalReservations = trips.reduce((sum, t) => sum + t.reservations.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Reservations</h1>
        <p className="text-muted-foreground">{totalReservations} reservation{totalReservations !== 1 ? "s" : ""} across {trips.length} trip{trips.length !== 1 ? "s" : ""}</p>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No reservations yet. Add them from a trip&apos;s detail page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {trips.map((trip) => (
            <div key={trip.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Link href={`/trips/${trip.id}`} className="group flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{trip.name}</h2>
                  <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </Link>
                <span className="text-xs text-muted-foreground">{trip.reservations.length} reservation{trip.reservations.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {trip.reservations.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-card">
                    <div className="shrink-0 text-muted-foreground">{typeIcon(r.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.providerName}</span>
                        <span className="text-xs text-muted-foreground">{typeLabel(r.type)}</span>
                        {r.confirmationNumber && (
                          <span className="text-xs font-mono text-muted-foreground">#{r.confirmationNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {r.departureLocation && r.arrivalLocation ? (
                          <span className="text-xs text-muted-foreground">{r.departureLocation} → {r.arrivalLocation}</span>
                        ) : r.location ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="size-2.5" />{r.location}</span>
                        ) : null}
                        {r.startDateTime && (
                          <span className="text-xs text-muted-foreground">{formatDateTime(r.startDateTime)}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {statusBadge(r.status)}
                      {r.cost !== null && (
                        <span className="text-sm font-medium">{formatCurrency(r.cost, r.currency)}</span>
                      )}
                      {r.isPaid && <Badge variant="outline" className="text-[10px] text-green-600">Paid</Badge>}
                      {r.bookingUrl && (
                        <a href={r.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
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
  );
}
