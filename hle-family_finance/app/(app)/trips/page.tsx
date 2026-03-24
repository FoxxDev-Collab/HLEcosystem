import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, MapPin, Receipt, Landmark } from "lucide-react";
import { createTripAction } from "./actions";

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [trips, projects] = await Promise.all([
    prisma.trip.findMany({
      where: { householdId },
      include: {
        expenses: { select: { amount: true } },
        _count: { select: { expenses: true } },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    prisma.budgetPlannerProject.findMany({
      where: { householdId, status: { in: ["PLANNING", "ACTIVE"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeTrips = trips.filter((t) => t.status === "ACTIVE" || t.status === "PLANNING");
  const totalSpent = trips.reduce(
    (sum, t) => sum + t.expenses.reduce((s, e) => s + Number(e.amount), 0),
    0
  );
  const taxDeductibleTotal = trips
    .filter((t) => t.isTaxDeductible)
    .reduce((sum, t) => sum + t.expenses.reduce((s, e) => s + Number(e.amount), 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Trips</h1>

      {/* Summary Cards */}
      {trips.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Trips</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{trips.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Active Trips</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{activeTrips.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Spent</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1">
                <Landmark className="size-3.5" /> Tax Deductible
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(taxDeductibleTotal)}</div></CardContent>
          </Card>
        </div>
      )}

      {/* New Trip Form */}
      <Card>
        <CardHeader><CardTitle>New Trip</CardTitle></CardHeader>
        <CardContent>
          <form action={createTripAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Trip Name</Label>
                <Input name="name" placeholder="e.g. Boise House Repair" required />
              </div>
              <div className="space-y-1">
                <Label>Destination</Label>
                <Input name="destination" placeholder="e.g. Boise, ID" />
              </div>
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input name="startDate" type="date" required />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input name="endDate" type="date" required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="space-y-1">
                <Label>Description</Label>
                <Input name="description" placeholder="Optional details" />
              </div>
              <div className="space-y-1">
                <Label>Linked Project</Label>
                <select
                  name="budgetPlannerProjectId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" name="isTaxDeductible" id="isTaxDeductible" className="size-4 rounded border-input" />
                <Label htmlFor="isTaxDeductible" className="cursor-pointer">Tax Deductible</Label>
              </div>
              <div className="space-y-1">
                <Label>Tax Purpose</Label>
                <Input name="taxPurpose" placeholder="e.g. Property repair" />
              </div>
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Create Trip</Button>
          </form>
        </CardContent>
      </Card>

      {/* Trip Cards */}
      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No trips yet. Create one to start tracking expenses.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => {
            const spent = trip.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
            return (
              <Card key={trip.id} className="hover:bg-accent/30 transition-colors h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Link href={`/trips/${trip.id}`}>
                      <CardTitle className="text-base hover:underline cursor-pointer">{trip.name}</CardTitle>
                    </Link>
                    <div className="flex items-center gap-1.5">
                      {trip.isTaxDeductible && (
                        <Badge variant="outline" className="text-green-600 border-green-300 dark:border-green-700">
                          <Landmark className="size-3 mr-1" />Tax
                        </Badge>
                      )}
                      <Badge className={STATUS_COLORS[trip.status]}>{trip.status}</Badge>
                    </div>
                  </div>
                  {trip.destination && (
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="size-3" />{trip.destination}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xl font-bold">{formatCurrency(spent)}</div>
                  <div className="text-xs text-muted-foreground">
                    <Receipt className="size-3 inline mr-1" />
                    {trip._count.expenses} expense{trip._count.expenses !== 1 ? "s" : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(trip.startDate)} &ndash; {formatDate(trip.endDate)}
                  </div>
                  {trip.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{trip.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
