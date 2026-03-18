import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency, formatMileage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CalendarClock,
  Wrench,
  Refrigerator,
  Car,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    itemCount,
    vehicleCount,
    overdueSchedules,
    dueThisWeek,
    activeRepairs,
    expiringWarranties,
    recentLogs,
    recentRepairs,
  ] = await Promise.all([
    prisma.item.count({ where: { householdId, isArchived: false } }),
    prisma.vehicle.count({ where: { householdId, isArchived: false } }),
    prisma.maintenanceSchedule.count({
      where: { householdId, isActive: true, nextDueDate: { lt: now } },
    }),
    prisma.maintenanceSchedule.findMany({
      where: {
        householdId,
        isActive: true,
        nextDueDate: { gte: now, lte: sevenDaysFromNow },
      },
      include: { item: true, vehicle: true },
      orderBy: { nextDueDate: "asc" },
    }),
    prisma.repair.count({
      where: { householdId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
    }),
    prisma.item.findMany({
      where: {
        householdId,
        isArchived: false,
        warrantyExpires: { gt: now, lte: thirtyDaysFromNow },
      },
      orderBy: { warrantyExpires: "asc" },
    }),
    prisma.maintenanceLog.findMany({
      where: { householdId },
      include: { item: true, vehicle: true },
      orderBy: { completedDate: "desc" },
      take: 5,
    }),
    prisma.repair.findMany({
      where: { householdId },
      include: { item: true, vehicle: true, provider: true },
      orderBy: { reportedDate: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Home & vehicle care overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertTriangle className={`size-4 ${overdueSchedules > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueSchedules > 0 ? "text-red-600" : ""}`}>{overdueSchedules}</div>
            <Link href="/schedules" className="text-xs text-muted-foreground hover:underline">View schedules</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Repairs</CardTitle>
            <Wrench className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRepairs}</div>
            <Link href="/repairs" className="text-xs text-muted-foreground hover:underline">View repairs</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Items Tracked</CardTitle>
            <Refrigerator className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemCount}</div>
            <Link href="/items" className="text-xs text-muted-foreground hover:underline">View items</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
            <Car className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicleCount}</div>
            <Link href="/vehicles" className="text-xs text-muted-foreground hover:underline">View vehicles</Link>
          </CardContent>
        </Card>
      </div>

      {/* Due This Week */}
      {dueThisWeek.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />Due This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {dueThisWeek.map((schedule) => (
                <div key={schedule.id} className="py-2">
                  <div className="text-sm font-medium">{schedule.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Due {formatDate(schedule.nextDueDate)}
                    {schedule.item && ` · ${schedule.item.name}`}
                    {schedule.vehicle && ` · ${schedule.vehicle.year ? `${schedule.vehicle.year} ` : ""}${schedule.vehicle.make} ${schedule.vehicle.model}`}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiring Warranties */}
      {expiringWarranties.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <ShieldCheck className="size-4" />Warranties Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {expiringWarranties.map((item) => (
                <Link key={item.id} href={`/items/${item.id}`} className="flex items-center justify-between py-2 hover:bg-muted/50 -mx-2 px-2 rounded">
                  <div className="text-sm">{item.name}</div>
                  <div className="text-xs text-yellow-700">Expires {formatDate(item.warrantyExpires)}</div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4" />Recent Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No maintenance logged yet.</p>
            ) : (
              <div className="divide-y">
                {recentLogs.map((log) => (
                  <div key={log.id} className="py-2">
                    <div className="text-sm font-medium">{log.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(log.completedDate)}
                      {log.completedBy && ` · ${log.completedBy}`}
                      {log.item && ` · ${log.item.name}`}
                      {log.vehicle && ` · ${log.vehicle.make} ${log.vehicle.model}`}
                      {log.cost && ` · ${formatCurrency(log.cost)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Repairs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-4" />Recent Repairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRepairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No repairs recorded yet.</p>
            ) : (
              <div className="divide-y">
                {recentRepairs.map((repair) => (
                  <div key={repair.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">{repair.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(repair.reportedDate)}
                        {repair.provider && ` · ${repair.provider.name}`}
                        {repair.totalCost && ` · ${formatCurrency(repair.totalCost)}`}
                      </div>
                    </div>
                    <Badge variant="secondary">{repair.status.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
