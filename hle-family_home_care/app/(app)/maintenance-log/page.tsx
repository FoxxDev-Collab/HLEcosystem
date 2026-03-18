import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency, formatMileage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, Trash2 } from "lucide-react";
import { createMaintenanceLogAction, deleteMaintenanceLogAction } from "./actions";

export default async function MaintenanceLogPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string; vehicleId?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const filters: Record<string, string> = {};
  if (params.itemId) filters.itemId = params.itemId;
  if (params.vehicleId) filters.vehicleId = params.vehicleId;

  const [items, vehicles, logs] = await Promise.all([
    prisma.item.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({
      where: { householdId, isArchived: false },
      orderBy: { make: "asc" },
    }),
    prisma.maintenanceLog.findMany({
      where: { householdId, ...filters },
      include: { item: true, vehicle: true },
      orderBy: { completedDate: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Maintenance Log</h1>

      <Card>
        <CardHeader><CardTitle>Log Maintenance</CardTitle></CardHeader>
        <CardContent>
          <form action={createMaintenanceLogAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>What was done?</Label>
              <Input name="title" placeholder="e.g. Replaced HVAC filter" required />
            </div>
            <div className="space-y-1">
              <Label>Item</Label>
              <Select name="itemId">
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vehicle</Label>
              <Select name="vehicleId">
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
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
              <Label>Completed Date</Label>
              <Input name="completedDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
            <div className="space-y-1">
              <Label>Done By</Label>
              <Input name="completedBy" placeholder="e.g. Self, contractor name" />
            </div>
            <div className="space-y-1">
              <Label>Cost</Label>
              <Input name="cost" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Mileage (vehicles)</Label>
              <Input name="mileageAtService" type="number" placeholder="Odometer" />
            </div>
            <div className="space-y-1">
              <Label>Parts Used</Label>
              <Input name="partsUsed" placeholder="e.g. 20x20x1 filter" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Additional details" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Log</Button>
          </form>
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="size-10 mx-auto mb-3 opacity-40" />
            <p>No maintenance records yet. Log completed maintenance to build your home&apos;s history.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>History ({logs.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Item / Vehicle</TableHead>
                  <TableHead>Done By</TableHead>
                  <TableHead>Parts</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.completedDate)}</TableCell>
                    <TableCell className="font-medium">
                      {log.title}
                      {log.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{log.notes}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.item?.name || (log.vehicle ? `${log.vehicle.year ? `${log.vehicle.year} ` : ""}${log.vehicle.make} ${log.vehicle.model}` : "\u2014")}
                      {log.mileageAtService ? ` (${formatMileage(log.mileageAtService)})` : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.completedBy || "\u2014"}</TableCell>
                    <TableCell className="text-muted-foreground">{log.partsUsed || "\u2014"}</TableCell>
                    <TableCell className="text-right">{log.cost ? formatCurrency(log.cost) : "\u2014"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={deleteMaintenanceLogAction}>
                        <input type="hidden" name="id" value={log.id} />
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
