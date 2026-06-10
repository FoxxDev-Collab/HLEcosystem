import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  FileKey,
  Package,
  Phone,
  Route as RouteIcon,
  Shield,
  Zap,
} from "lucide-react"
import { getEmergencyOverviewFn } from "@/server/home-care/fns.emergency"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/home-care/emergency/")({
  loader: () => getEmergencyOverviewFn(),
  component: EmergencyOverviewPage,
})

function todayStr(): string {
  const t = new Date()
  const mm = String(t.getMonth() + 1).padStart(2, "0")
  const dd = String(t.getDate()).padStart(2, "0")
  return `${t.getFullYear()}-${mm}-${dd}`
}

function EmergencyOverviewPage() {
  const { counts, expiringSupplies, plansNeedingReview } = Route.useLoaderData()
  const today = todayStr()

  const expiredSupplies = expiringSupplies.filter(
    (s) => s.expirationDate <= today
  )
  const soonExpiringSupplies = expiringSupplies.filter(
    (s) => s.expirationDate > today
  )
  const hasAlerts =
    expiredSupplies.length > 0 ||
    soonExpiringSupplies.length > 0 ||
    plansNeedingReview.length > 0

  const summaryCards = [
    {
      to: "/home-care/emergency/contacts",
      icon: Phone,
      iconClass: "bg-blue-100 text-blue-700",
      value: counts.contactCount,
      label: "Emergency Contacts",
    },
    {
      to: "/home-care/emergency/plans",
      icon: RouteIcon,
      iconClass: "bg-purple-100 text-purple-700",
      value: counts.planCount,
      label: "Emergency Plans",
    },
    {
      to: "/home-care/emergency/supplies",
      icon: Package,
      iconClass: "bg-green-100 text-green-700",
      value: counts.kitCount,
      label: "Supply Kits",
    },
    {
      to: "/home-care/emergency/supplies",
      icon: AlertTriangle,
      iconClass:
        expiringSupplies.length > 0
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-700",
      value: expiringSupplies.length,
      label: "Expiring Supplies",
    },
  ]

  const quickLinks = [
    {
      to: "/home-care/emergency/contacts",
      icon: Phone,
      title: "Emergency Contacts",
      description: "Neighbors, utilities, services",
    },
    {
      to: "/home-care/emergency/plans",
      icon: RouteIcon,
      title: "Emergency Plans",
      description: "Fire, flood, evacuation procedures",
    },
    {
      to: "/home-care/emergency/supplies",
      icon: Package,
      title: "Supply Kits",
      description: "Track emergency supplies and expiration",
    },
    {
      to: "/home-care/emergency/documents",
      icon: FileKey,
      title: "Important Documents",
      description: "Know where critical documents are",
    },
    {
      to: "/home-care/emergency/utilities",
      icon: Zap,
      title: "Utility Shutoffs",
      description: "Gas, water, electric shutoff locations",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Emergency Preparedness</h1>
        <p className="text-sm text-muted-foreground">
          Contacts, plans, supplies, and shutoffs — everything for when things
          go wrong.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c, i) => (
          <Link key={`${c.label}-${i}`} to={c.to}>
            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.iconClass}`}
                  >
                    <c.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{c.value}</p>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {hasAlerts && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-200">
              <AlertTriangle className="size-5" />
              Attention Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expiredSupplies.length > 0 && (
              <div className="flex items-start gap-2">
                <Badge variant="destructive">
                  {expiredSupplies.length} Expired
                </Badge>
                <span className="text-sm text-amber-900 dark:text-amber-100">
                  {expiredSupplies
                    .map((s) => `${s.name} (${s.kitName})`)
                    .join(", ")}
                </span>
              </div>
            )}
            {soonExpiringSupplies.length > 0 && (
              <div className="flex items-start gap-2">
                <Badge className="bg-yellow-100 text-yellow-800">
                  {soonExpiringSupplies.length} Expiring Soon
                </Badge>
                <span className="text-sm text-amber-900 dark:text-amber-100">
                  {soonExpiringSupplies
                    .map((s) => `${s.name} (${formatDate(s.expirationDate)})`)
                    .join(", ")}
                </span>
              </div>
            )}
            {plansNeedingReview.length > 0 && (
              <div className="flex items-start gap-2">
                <Badge className="bg-orange-100 text-orange-800">
                  {plansNeedingReview.length} Need Review
                </Badge>
                <span className="text-sm text-amber-900 dark:text-amber-100">
                  {plansNeedingReview.map((p) => p.title).join(", ")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((l) => (
          <Link key={l.title} to={l.to}>
            <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 pt-6">
                <l.icon className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {l.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        <Card className="border-dashed opacity-60">
          <CardContent className="flex items-center gap-3 pt-6">
            <Shield className="size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Stay Prepared</p>
              <p className="text-sm text-muted-foreground">
                Review plans regularly, check supplies
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
