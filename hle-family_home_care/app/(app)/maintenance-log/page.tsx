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
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <div className="text-sm font-medium">{log.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(log.completedDate)}
                      {log.completedBy && ` · ${log.completedBy}`}
                      {log.item && ` · ${log.item.name}`}
                      {log.vehicle && ` · ${log.vehicle.year ? `${log.vehicle.year} ` : ""}${log.vehicle.make} ${log.vehicle.model}`}
                      {log.mileageAtService && ` · ${formatMileage(log.mileageAtService)}`}
                      {log.cost && ` · ${formatCurrency(log.cost)}`}
                    </div>
                    {log.partsUsed && <div className="text-xs text-muted-foreground">Parts: {log.partsUsed}</div>}
                    {log.notes && <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{log.status}</Badge>
                    <form action={deleteMaintenanceLogAction}>
                      <input type="hidden" name="id" value={log.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="size-3.5 text-red-500" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
