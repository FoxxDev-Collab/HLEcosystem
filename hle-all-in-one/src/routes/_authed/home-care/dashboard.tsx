import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  CalendarClock,
  Car,
  ClipboardList,
  Refrigerator,
  ShieldCheck,
  Wrench,
} from "lucide-react"
import { getHomeCareDashboardFn } from "@/server/home-care/fns.dashboard"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/home-care/dashboard")({
  loader: () => getHomeCareDashboardFn(),
  component: HomeCareDashboardPage,
})

function HomeCareDashboardPage() {
  const {
    itemCount,
    vehicleCount,
    overdueCount,
    activeRepairCount,
    dueThisWeek,
    expiringWarranties,
    recentLogs,
    recentRepairs,
  } = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Home &amp; vehicle care overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertTriangle
              className={`size-4 ${overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${overdueCount > 0 ? "text-destructive" : ""}`}
            >
              {overdueCount}
            </div>
            <Link
              to="/home-care/schedules"
              className="text-xs text-muted-foreground hover:underline"
            >
              View schedules
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Repairs
            </CardTitle>
            <Wrench className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRepairCount}</div>
            <Link
              to="/home-care/repairs"
              className="text-xs text-muted-foreground hover:underline"
            >
              View repairs
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Items Tracked</CardTitle>
            <Refrigerator className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemCount}</div>
            <Link
              to="/home-care/items"
              className="text-xs text-muted-foreground hover:underline"
            >
              View items
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
            <Car className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicleCount}</div>
            <Link
              to="/home-care/vehicles"
              className="text-xs text-muted-foreground hover:underline"
            >
              View vehicles
            </Link>
          </CardContent>
        </Card>
      </div>

      {dueThisWeek.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              Due This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {dueThisWeek.map((schedule) => (
                <div key={schedule.id} className="py-2">
                  <div className="text-sm font-medium">{schedule.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Due {formatDate(schedule.nextDueDate)}
                    {schedule.itemName && ` · ${schedule.itemName}`}
                    {schedule.vehicleMake &&
                      ` · ${schedule.vehicleYear ? `${schedule.vehicleYear} ` : ""}${schedule.vehicleMake} ${schedule.vehicleModel ?? ""}`}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {expiringWarranties.length > 0 && (
        <Card className="border-yellow-300/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-yellow-600" />
              Warranties Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {expiringWarranties.map((item) => (
                <Link
                  key={item.id}
                  to="/home-care/items/$id"
                  params={{ id: item.id }}
                  className="-mx-2 flex items-center justify-between rounded px-2 py-2 hover:bg-muted/50"
                >
                  <div className="text-sm">{item.name}</div>
                  <div className="text-xs text-yellow-700">
                    Expires {formatDate(item.warrantyExpires)}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4" />
              Recent Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No maintenance logged yet.
              </p>
            ) : (
              <div className="divide-y">
                {recentLogs.map((log) => (
                  <div key={log.id} className="py-2">
                    <div className="text-sm font-medium">{log.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(log.completedDate)}
                      {log.completedBy && ` · ${log.completedBy}`}
                      {log.itemName && ` · ${log.itemName}`}
                      {log.vehicleMake &&
                        ` · ${log.vehicleMake} ${log.vehicleModel ?? ""}`}
                      {log.cost ? ` · ${formatCurrency(log.cost)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-4" />
              Recent Repairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRepairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No repairs recorded yet.
              </p>
            ) : (
              <div className="divide-y">
                {recentRepairs.map((repair) => (
                  <div
                    key={repair.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{repair.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(repair.reportedDate)}
                        {repair.providerName && ` · ${repair.providerName}`}
                        {repair.totalCost
                          ? ` · ${formatCurrency(repair.totalCost)}`
                          : ""}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {repair.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
