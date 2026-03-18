import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatMileage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Gauge, Trash2 } from "lucide-react";
import { createMileageEntryAction, deleteMileageEntryAction } from "./actions";

export default async function MileagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const vehicles = await prisma.vehicle.findMany({
    where: { householdId, isArchived: false, status: "ACTIVE" },
    orderBy: { make: "asc" },
  });

  const entries = await prisma.mileageEntry.findMany({
    where: { vehicle: { householdId } },
    include: { vehicle: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Mileage Log</h1>

      <Card>
        <CardHeader><CardTitle>Log Mileage</CardTitle></CardHeader>
        <CardContent>
          <form action={createMileageEntryAction} className="grid gap-4 sm:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Vehicle</Label>
              <Select name="vehicleId" required>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.year ? `${v.year} ` : ""}{v.make} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Odometer Reading</Label>
              <Input name="mileage" type="number" placeholder="45230" required />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Log</Button>
          </form>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Gauge className="size-10 mx-auto mb-3 opacity-40" />
            <p>No mileage entries yet. Log your odometer readings to track driving history.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Recent Entries ({entries.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Odometer</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.vehicle.year ? `${entry.vehicle.year} ` : ""}{entry.vehicle.make} {entry.vehicle.model}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMileage(entry.mileage)}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.notes || "\u2014"}</TableCell>
                    <TableCell className="text-right">
                      <form action={deleteMileageEntryAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="size-3.5 text-red-500" />
                        </Button>
                      </form>
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
