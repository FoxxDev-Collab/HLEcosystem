import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { z } from "zod"
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Wrench,
} from "lucide-react"
import { getHomeCareCalendarFn } from "@/server/home-care/fns.dashboard"
import type {
  CalendarEventKind,
  CalendarEventRow,
} from "@/server/home-care/dashboard"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// month in the URL is 1-based (legacy convention); the server fn wants
// 0-based.
const searchSchema = z.object({
  year: z.coerce.number().int().min(1970).max(2200).optional().catch(undefined),
  month: z.coerce.number().int().min(1).max(12).optional().catch(undefined),
})

export const Route = createFileRoute("/_authed/home-care/calendar")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ year: search.year, month: search.month }),
  loader: ({ deps }) => {
    const now = new Date()
    const year = deps.year ?? now.getFullYear()
    const month = deps.month ? deps.month - 1 : now.getMonth()
    return getHomeCareCalendarFn({ data: { year, month } })
  },
  component: HomeCareCalendarPage,
})

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const EVENT_COLORS: Record<CalendarEventKind, string> = {
  maintenance: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  repair: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  warranty: "bg-orange-500/15 text-orange-700 border-orange-500/30",
}

const EVENT_ICONS: Record<
  CalendarEventKind,
  typeof CalendarClock | typeof Wrench | typeof ShieldAlert
> = {
  maintenance: CalendarClock,
  repair: Wrench,
  warranty: ShieldAlert,
}

function EventLink({
  event,
  className,
  children,
}: {
  event: CalendarEventRow
  className?: string
  children: React.ReactNode
}) {
  if (event.kind === "warranty" && event.itemId) {
    return (
      <Link
        to="/home-care/items/$id"
        params={{ id: event.itemId }}
        className={className}
      >
        {children}
      </Link>
    )
  }
  if (event.kind === "repair") {
    return (
      <Link to="/home-care/repairs" className={className}>
        {children}
      </Link>
    )
  }
  return (
    <Link to="/home-care/schedules" className={className}>
      {children}
    </Link>
  )
}

function HomeCareCalendarPage() {
  const events = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()

  const now = new Date()
  const year = search.year ?? now.getFullYear()
  const month = search.month ? search.month - 1 : now.getMonth()

  function goTo(targetYear: number, targetMonth1: number) {
    router.navigate({
      to: "/home-care/calendar",
      search: { year: targetYear, month: targetMonth1 },
    })
  }

  const prevMonth = month === 0 ? 12 : month
  const prevYear = month === 0 ? year - 1 : year
  const nextMonth = month === 11 ? 1 : month + 2
  const nextYear = month === 11 ? year + 1 : year

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDate =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1

  // Group events by day of month ("YYYY-MM-DD" strings from the server).
  const eventsByDay = new Map<number, Array<CalendarEventRow>>()
  for (const event of events) {
    const day = Number(event.date.slice(8, 10))
    const list = eventsByDay.get(day)
    if (list) {
      list.push(event)
    } else {
      eventsByDay.set(day, [event])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Maintenance due dates, scheduled repairs and warranty expirations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => goTo(prevYear, prevMonth)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => goTo(nextYear, nextMonth)}
          >
            <ChevronRight className="size-4" />
          </Button>
          {(year !== now.getFullYear() || month !== now.getMonth()) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() =>
                router.navigate({ to: "/home-care/calendar", search: {} })
              }
            >
              Today
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="mb-1 grid grid-cols-7">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[80px] bg-muted/30 p-1 sm:min-h-[100px]"
              />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isToday = day === todayDate
              const dayEvents = eventsByDay.get(day) || []
              return (
                <div
                  key={day}
                  className={`min-h-[80px] bg-background p-1 sm:min-h-[100px] ${
                    isToday ? "ring-2 ring-primary ring-inset" : ""
                  }`}
                >
                  <div
                    className={`mb-0.5 text-xs font-medium ${
                      isToday
                        ? "font-bold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventLink
                        key={event.id}
                        event={event}
                        className={`block truncate rounded border px-1 py-0.5 text-[10px] leading-tight sm:text-xs ${EVENT_COLORS[event.kind]}`}
                      >
                        {event.title}
                      </EventLink>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="px-1 text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {events.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>This Month ({events.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {events.map((event) => {
                const Icon = EVENT_ICONS[event.kind]
                return (
                  <div key={event.id} className="flex items-center gap-3 py-3">
                    <div
                      className={`flex size-8 items-center justify-center rounded-full border ${EVENT_COLORS[event.kind]}`}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        <EventLink event={event} className="hover:underline">
                          {event.title}
                        </EventLink>
                      </div>
                      {event.entityName && (
                        <p className="text-xs text-muted-foreground">
                          {event.entityName}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(event.date)}
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {event.kind}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">
              No events scheduled for {MONTH_NAMES[month]} {year}.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded border border-blue-500/30 bg-blue-500/20" />
          Maintenance
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded border border-yellow-500/30 bg-yellow-500/20" />
          Repairs
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded border border-orange-500/30 bg-orange-500/20" />
          Warranty Expiry
        </div>
      </div>
    </div>
  )
}
