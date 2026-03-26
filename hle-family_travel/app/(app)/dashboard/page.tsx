import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, FileText, MapPin } from "lucide-react";
import Link from "next/link";
import { formatDate, daysUntil } from "@/lib/format";

export default async function DashboardPage() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  const [trips, expiringDocs] = await Promise.all([
    prisma.trip.findMany({
      where: { householdId, status: { in: ["PLANNING", "BOOKED", "IN_PROGRESS"] } },
      orderBy: { startDate: "asc" },
      include: { travelers: true, packingLists: { include: { items: true } } },
      take: 5,
    }),
    prisma.travelDocument.findMany({
      where: {
        householdId,
        expiryDate: {
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
      orderBy: { expiryDate: "asc" },
      take: 5,
    }),
  ]);

  const totalTrips = await prisma.trip.count({ where: { householdId } });
  const totalDocs = await prisma.travelDocument.count({ where: { householdId } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

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
            <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
            <MapPin className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trips.length}</div>
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

      {trips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Trips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trips.map((trip) => {
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
                    <div>
                      <div className="font-medium">{trip.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {trip.destination && `${trip.destination} · `}
                        {formatDate(trip.startDate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalItems > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {packedCount}/{totalItems} packed
                        </span>
                      )}
                      {days !== null && days >= 0 && (
                        <Badge variant={days <= 7 ? "default" : "secondary"}>
                          {days === 0 ? "Today" : `${days}d`}
                        </Badge>
                      )}
                      <Badge variant="outline" className="capitalize">
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

      {expiringDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expiring Documents</CardTitle>
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

      {trips.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Plane className="mx-auto size-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No trips yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start planning your next adventure!
            </p>
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
