import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency, formatMileage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Car } from "lucide-react";
import { createVehicleAction } from "./actions";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  SOLD: "bg-gray-100 text-gray-800",
  SCRAPPED: "bg-red-100 text-red-800",
  STORED: "bg-blue-100 text-blue-800",
};

export default async function VehiclesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const vehicles = await prisma.vehicle.findMany({
    where: { householdId, isArchived: false },
    orderBy: [{ status: "asc" }, { year: "desc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Vehicles</h1>

      <Card>
        <CardHeader><CardTitle>Add Vehicle</CardTitle></CardHeader>
        <CardContent>
          <form action={createVehicleAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Year</Label>
              <Input name="year" type="number" placeholder="2024" />
            </div>
            <div className="space-y-1">
              <Label>Make</Label>
              <Input name="make" placeholder="e.g. Toyota" required />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input name="model" placeholder="e.g. Camry" required />
            </div>
            <div className="space-y-1">
              <Label>Trim</Label>
              <Input name="trim" placeholder="e.g. SE, XLE" />
            </div>
            <div className="space-y-1">
              <Label>VIN</Label>
              <Input name="vin" placeholder="Vehicle ID Number" />
            </div>
            <div className="space-y-1">
              <Label>License Plate</Label>
              <Input name="licensePlate" placeholder="ABC-1234" />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input name="color" placeholder="e.g. Silver" />
            </div>
            <div className="space-y-1">
              <Label>Current Mileage</Label>
              <Input name="currentMileage" type="number" placeholder="45000" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input name="purchaseDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Price</Label>
              <Input name="purchasePrice" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Purchased From</Label>
              <Input name="purchasedFrom" placeholder="Dealership" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Vehicle</Button>
          </form>
        </CardContent>
      </Card>

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Car className="size-10 mx-auto mb-3 opacity-40" />
            <p>No vehicles yet. Add your cars, trucks, and other vehicles.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <Link key={v.id} href={`/vehicles/${v.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">
                      {v.year ? `${v.year} ` : ""}{v.make} {v.model}
                    </CardTitle>
                    {v.trim && <p className="text-xs text-muted-foreground">{v.trim}</p>}
                  </div>
                  <Badge className={STATUS_COLORS[v.status]}>{v.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {v.currentMileage && <div>{formatMileage(v.currentMileage)}</div>}
                  {v.licensePlate && <div>Plate: {v.licensePlate}</div>}
                  {v.color && <div>Color: {v.color}</div>}
                  {v.purchasePrice && <div>Paid: {formatCurrency(v.purchasePrice)}</div>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
