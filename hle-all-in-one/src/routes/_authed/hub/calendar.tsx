import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getCalendarPageFn } from "@/server/hub/fns.dates"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/hub/calendar")({
  loader: () => getCalendarPageFn(),
  component: CalendarPage,
})

const DATE_TYPE_COLORS: Record<string, string> = {
  BIRTHDAY: "bg-blue-500",
  ANNIVERSARY: "bg-pink-500",
  GRADUATION: "bg-purple-500",
  MEMORIAL: "bg-gray-500",
  HOLIDAY: "bg-green-500",
  CUSTOM: "bg-orange-500",
  TODO: "bg-yellow-500",
}

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

type CalendarEvent = { id: string; label: string; type: string }

function CalendarPage() {
  const { dates, todos } = Route.useLoaderData()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  function goPrev() {
    if (month === 0) {
      setMonth(11)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  function goNext() {
    if (month === 11) {
      setMonth(0)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  // Build the month grid.
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const totalDays = lastDay.getDate()

  // Map events to day numbers for this month. ANNUAL dates (incl. derived
  // birthdays/anniversaries) match on month regardless of year; ONCE dates
  // and todo due dates require an exact month + year match.
  const dayEvents = new Map<number, Array<CalendarEvent>>()
  function addEvent(day: number, event: CalendarEvent) {
    const list = dayEvents.get(day)
    if (list) {
      list.push(event)
    } else {
      dayEvents.set(day, [event])
    }
  }

  for (const d of dates) {
    const eventYear = Number(d.date.slice(0, 4))
    const eventMonth = Number(d.date.slice(5, 7)) - 1
    const eventDay = Number(d.date.slice(8, 10))
    if (eventMonth !== month) continue
    if (d.recurrenceType !== "ANNUAL" && eventYear !== year) continue
    addEvent(eventDay, { id: d.id, label: d.label, type: d.type })
  }

  for (const item of todos) {
    const dueYear = Number(item.dueDate.slice(0, 4))
    const dueMonth = Number(item.dueDate.slice(5, 7)) - 1
    const dueDay = Number(item.dueDate.slice(8, 10))
    if (dueMonth === month && dueYear === year) {
      addEvent(dueDay, { id: item.id, label: item.title, type: "TODO" })
    }
  }

  const today = new Date()
  const isCurrentMonth =
    today.getMonth() === month && today.getFullYear() === year

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Important dates, birthdays, anniversaries and to-do due dates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goPrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <CardTitle>
              {MONTH_NAMES[month]} {year}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={goNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: startPad }).map((_, i) => (
              <div
                key={`pad-${i}`}
                className="min-h-[80px] rounded bg-muted/30 p-1"
              />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1
              const events = dayEvents.get(day) || []
              const isToday = isCurrentMonth && today.getDate() === day
              return (
                <div
                  key={day}
                  className={`min-h-[80px] rounded border p-1 ${
                    isToday ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div
                    className={`mb-1 text-xs font-medium ${
                      isToday
                        ? "font-bold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-center gap-1">
                        <div
                          className={`size-2 shrink-0 rounded-full ${DATE_TYPE_COLORS[event.type]}`}
                        />
                        <span className="truncate text-[10px]">
                          {event.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
            {Object.entries(DATE_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div className={`size-2 rounded-full ${color}`} />
                <span className="text-xs text-muted-foreground">{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
