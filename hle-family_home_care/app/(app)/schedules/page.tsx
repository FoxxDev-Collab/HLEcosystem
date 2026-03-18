import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatFrequency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CalendarClock, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { createScheduleAction, completeScheduleAction, deleteScheduleAction } from "./actions";

const FREQUENCIES = [
  "WEEKLY", "BI_WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUALLY", "ANNUALLY", "CUSTOM_DAYS",
];

export default async function SchedulesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [items, vehicles, schedules] = await Promise.all([
    prisma.item.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({
      where: { householdId, isArchived: false },
      orderBy: { make: "asc" },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { householdId },
      include: { item: true, vehicle: true },
      orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }],
    }),
  ]);

  const now = new Date();
  const overdue = schedules.filter((s) => s.isActive && s.nextDueDate && s.nextDueDate < now);
  const upcoming = schedules.filter((s) => s.isActive && (!s.nextDueDate || s.nextDueDate >= now));
  const inactive = schedules.filter((s) => !s.isActive);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Maintenance Schedules</h1>

      {overdue.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-red-800">
              <AlertTriangle className="size-4" />
              <span><strong>{overdue.length}</strong> overdue task{overdue.length !== 1 ? "s" : ""}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Create Schedule</CardTitle></CardHeader>
        <CardContent>
          <form action={createScheduleAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Task Title</Label>
              <Input name="title" placeholder="e.g. Replace HVAC filter" required />
            </div>
            <div className="space-y-1">
              <Label>For Item</Label>
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
              <Label>For Vehicle</Label>
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
              <Label>Frequency</Label>
              <Select name="frequency" defaultValue="MONTHLY">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Next Due Date</Label>
              <Input name="nextDueDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Est. Cost</Label>
              <Input name="estimatedCost" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Assigned To</Label>
              <Input name="assignedTo" placeholder="Who handles this?" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Create</Button>
          </form>
        </CardContent>
      </Card>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarClock className="size-10 mx-auto mb-3 opacity-40" />
            <p>No maintenance schedules yet. Create recurring tasks to stay on top of home & vehicle care.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {overdue.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-red-700">Overdue ({overdue.length})</CardTitle></CardHeader>
              <CardContent>
                <ScheduleTable schedules={overdue} now={now} isOverdue />
              </CardContent>
            </Card>
          )}

          {upcoming.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Active Schedules ({upcoming.length})</CardTitle></CardHeader>
              <CardContent>
                <ScheduleTable schedules={upcoming} now={now} />
              </CardContent>
            </Card>
          )}

          {inactive.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-muted-foreground">Inactive ({inactive.length})</CardTitle></CardHeader>
              <CardContent className="opacity-60">
                <ScheduleTable schedules={inactive} now={now} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ScheduleTable({
  schedules,
  now,
  isOverdue = false,
}: {
  schedules: {
    id: string;
    title: string;
    frequency: string;
    customIntervalDays: number | null;
    nextDueDate: Date | null;
    lastCompletedDate: Date | null;
    assignedTo: string | null;
    item: { name: string } | null;
    vehicle: { year: number | null; make: string; model: string } | null;
  }[];
  now: Date;
  isOverdue?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>For</TableHead>
          <TableHead>Frequency</TableHead>
          <TableHead>Next Due</TableHead>
          <TableHead>Last Done</TableHead>
          <TableHead>Assigned</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((s) => (
          <TableRow key={s.id}>
            <TableCell className={`font-medium ${isOverdue ? "text-red-700" : ""}`}>
              {s.title}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {s.item?.name || (s.vehicle ? `${s.vehicle.year ? `${s.vehicle.year} ` : ""}${s.vehicle.make} ${s.vehicle.model}` : "\u2014")}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatFrequency(s.frequency, s.customIntervalDays)}
            </TableCell>
            <TableCell>
              {s.nextDueDate ? (
                <span className={s.nextDueDate < now ? "text-red-600 font-medium" : ""}>
                  {formatDate(s.nextDueDate)}
                </span>
              ) : "\u2014"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {s.lastCompletedDate ? formatDate(s.lastCompletedDate) : "Never"}
            </TableCell>
            <TableCell className="text-muted-foreground">{s.assignedTo || "\u2014"}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <form action={completeScheduleAction}>
                  <input type="hidden" name="scheduleId" value={s.id} />
                  <input type="hidden" name="completedDate" value={new Date().toISOString().split("T")[0]} />
                  <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Mark Complete">
                    <CheckCircle2 className="size-3.5 text-green-600" />
                  </Button>
                </form>
                <form action={deleteScheduleAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                    <Trash2 className="size-3.5 text-red-500" />
                  </Button>
                </form>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
