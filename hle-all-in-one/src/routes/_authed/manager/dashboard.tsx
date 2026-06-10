import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { Home, ShieldCheck, Users } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const authed = getRouteApi("/_authed")

export const Route = createFileRoute("/_authed/manager/dashboard")({
  component: DashboardPage,
})

function DashboardPage() {
  const { user, activeHousehold, households } = authed.useLoaderData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome back, {user.name}</h1>
        <p className="text-sm text-muted-foreground">
          {activeHousehold
            ? `Active household: ${activeHousehold.name}`
            : "You have no active household yet."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Your role</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
              {user.role}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Households</CardTitle>
            <Home className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{households.length}</div>
            <CardDescription>you belong to</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Access</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              {user.role === "ADMIN"
                ? "You can manage all users and households."
                : "You can manage your own households."}
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
