import { Link, createFileRoute } from "@tanstack/react-router"
import type { LinkProps } from "@tanstack/react-router"
import {
  ArrowRight,
  CalendarDays,
  Film,
  Gift,
  Heart,
  Lightbulb,
  ListTodo,
  Plus,
  Users,
} from "lucide-react"
import { getDashboardFn } from "@/server/hub/fns.dashboard"
import type { GiftStatus } from "@/server/hub/dashboard"
import { formatDateLong, formatDateShort } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/hub/dashboard")({
  loader: () => getDashboardFn(),
  component: DashboardPage,
})

const STATUS_COLORS: Record<GiftStatus, string> = {
  IDEA: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PURCHASED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  WRAPPED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  GIVEN: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
}

function DashboardPage() {
  const data = Route.useLoaderData()

  return (
    <div className="max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          Welcome back, {data.userFirstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDateLong(new Date())}
        </p>
      </div>

      {data.spouse && (
        <Card className="border-rose-200 dark:border-rose-800">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
              <Heart className="size-6 text-rose-500" fill="currentColor" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold">
                {data.userFirstName} & {data.spouse.firstName}
              </p>
              {data.wedding ? (
                <p className="text-sm text-muted-foreground">
                  Married {formatDateShort(data.wedding.date)}
                  {data.wedding.years !== null && data.wedding.years > 0 && (
                    <span>
                      {" "}
                      &middot; {data.wedding.years}{" "}
                      {data.wedding.years === 1 ? "year" : "years"}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Married &middot;{" "}
                  <Link
                    to="/hub/dates"
                    className="text-rose-600 hover:underline"
                  >
                    Add your wedding date
                  </Link>
                </p>
              )}
            </div>
            {data.householdName && (
              <Badge
                variant="outline"
                className="border-rose-300 text-rose-700 dark:text-rose-300"
              >
                {data.householdName}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="People"
          value={data.memberCount}
          hint="family members"
          icon={<Users className="size-3.5 text-muted-foreground/50" />}
        />
        <StatCard
          label="Upcoming"
          value={data.upcoming30Count}
          hint="next 30 days"
          icon={<CalendarDays className="size-3.5 text-muted-foreground/50" />}
        />
        <StatCard
          label="Gift Ideas"
          value={data.activeIdeas}
          hint="active ideas"
          icon={<Lightbulb className="size-3.5 text-muted-foreground/50" />}
        />
        <StatCard
          label="Gifts Given"
          value={data.giftsGiven}
          hint="all time"
          icon={<Gift className="size-3.5 text-muted-foreground/50" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Upcoming Events</h2>
              </div>
              <Link
                to="/hub/dates"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {data.upcoming.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No upcoming events.
                  </p>
                ) : (
                  <div className="divide-y">
                    {data.upcoming.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {event.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateShort(event.nextDate)}
                            {event.memberName && ` - ${event.memberName}`}
                          </p>
                        </div>
                        <Badge
                          variant={
                            event.days === 0 ? "destructive" : "secondary"
                          }
                          className="ml-3 shrink-0 text-[10px]"
                        >
                          {event.days === 0 ? "Today!" : `${event.days}d`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Recent Gifts</h2>
              </div>
              <Link
                to="/hub/gifts"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {data.recentGifts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No gifts recorded yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {data.recentGifts.map((gift) => (
                      <div
                        key={gift.id}
                        className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {gift.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            For {gift.memberFirstName} {gift.memberLastName}
                            {gift.occasion && ` - ${gift.occasion}`}
                          </p>
                        </div>
                        <Badge
                          className={`${STATUS_COLORS[gift.status]} ml-3 shrink-0 text-[10px]`}
                        >
                          {gift.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Family</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <OverviewLink
                to="/hub/people"
                icon={<Users className="size-4 text-muted-foreground" />}
                label="People"
                count={data.memberCount}
              />
              <OverviewLink
                to="/hub/dates"
                icon={<CalendarDays className="size-4 text-muted-foreground" />}
                label="Events"
                count={data.totalEvents}
              />
              <OverviewLink
                to="/hub/gift-ideas"
                icon={<Lightbulb className="size-4 text-muted-foreground" />}
                label="Gift Ideas"
                count={data.activeIdeas}
              />
              <OverviewLink
                to="/hub/todos"
                icon={<ListTodo className="size-4 text-muted-foreground" />}
                label="To-Do Lists"
                count={data.todoListCount}
              />
              {data.mediaRequestCount > 0 && (
                <Link
                  to="/hub/media-requests"
                  className="-mx-2 flex items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <Film className="size-4 text-muted-foreground" />
                    <span>Pending Requests</span>
                  </div>
                  <Badge variant="destructive" className="text-[9px]">
                    {data.mediaRequestCount}
                  </Badge>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <QuickAction
                to="/hub/people"
                icon={<Plus className="size-3.5" />}
                label="Add person"
              />
              <QuickAction
                to="/hub/gift-ideas"
                icon={<Lightbulb className="size-3.5" />}
                label="New gift idea"
              />
              <QuickAction
                to="/hub/dates"
                icon={<CalendarDays className="size-3.5" />}
                label="Add important date"
              />
              <QuickAction
                to="/hub/todos"
                icon={<ListTodo className="size-3.5" />}
                label="Create to-do list"
              />
              <QuickAction
                to="/hub/tree"
                icon={<Users className="size-3.5" />}
                label="View family tree"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: number
  hint: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="px-4 pt-4 pb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          {icon}
        </div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function OverviewLink({
  to,
  icon,
  label,
  count,
}: {
  to: LinkProps["to"]
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <Link
      to={to}
      className="-mx-2 flex items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-center gap-2.5 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">
        {count}
      </span>
    </Link>
  )
}

function QuickAction({
  to,
  icon,
  label,
}: {
  to: LinkProps["to"]
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
    >
      {icon}
      {label}
    </Link>
  )
}
