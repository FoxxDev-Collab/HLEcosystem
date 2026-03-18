import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatMileage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        <Card>
          <CardHeader><CardTitle>All Vehicles ({vehicles.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead className="text-right">Mileage</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link href={`/vehicles/${v.id}`} className="font-medium hover:underline">
                        {v.year ? `${v.year} ` : ""}{v.make} {v.model}
                      </Link>
                      {v.trim && <span className="text-muted-foreground text-xs ml-1">{v.trim}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{v.color || "\u2014"}</TableCell>
                    <TableCell className="text-muted-foreground">{v.licensePlate || "\u2014"}</TableCell>
                    <TableCell className="text-right">{formatMileage(v.currentMileage)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {v.purchasePrice ? formatCurrency(v.purchasePrice) : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[v.status]}>{v.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
