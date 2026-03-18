import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getCalendarEvents, type CalendarEvent } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Wrench, CalendarClock, ShieldAlert } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_COLORS = {
  maintenance: "bg-blue-100 text-blue-800 border-blue-200",
  repair: "bg-yellow-100 text-yellow-800 border-yellow-200",
  warranty: "bg-orange-100 text-orange-800 border-orange-200",
};

const EVENT_ICONS = {
  maintenance: CalendarClock,
  repair: Wrench,
  warranty: ShieldAlert,
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const now = new Date();
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const month = params.month ? parseInt(params.month) - 1 : now.getMonth();

  const events = await getCalendarEvents(householdId, year, month);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const prevMonth = month === 0 ? 12 : month;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 1 : month + 2;
  const nextYear = month === 11 ? year + 1 : year;

  // Group events by day
  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    const day = event.date.getDate();
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(event);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-2">
          <Link href={`/calendar?year=${prevYear}&month=${prevMonth}`}>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <Link href={`/calendar?year=${nextYear}&month=${nextMonth}`}>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronRight className="size-4" />
            </Button>
          </Link>
          {(year !== now.getFullYear() || month !== now.getMonth()) && (
            <Link href="/calendar">
              <Button variant="ghost" size="sm" className="text-xs">Today</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-muted/30 min-h-[80px] sm:min-h-[100px] p-1" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === todayDate;
              const dayEvents = eventsByDay.get(day) || [];

              return (
                <div
                  key={day}
                  className={`bg-background min-h-[80px] sm:min-h-[100px] p-1 ${
                    isToday ? "ring-2 ring-primary ring-inset" : ""
                  }`}
                >
                  <div className={`text-xs font-medium mb-0.5 ${
                    isToday ? "text-primary font-bold" : "text-muted-foreground"
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <Link
                        key={event.id}
                        href={event.entityHref || "#"}
                        className={`block text-[10px] sm:text-xs leading-tight px-1 py-0.5 rounded border truncate ${EVENT_COLORS[event.type]}`}
                      >
                        {event.title}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Events list for the month */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>This Month ({events.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {events.map((event) => {
                const Icon = EVENT_ICONS[event.type];
                return (
                  <div key={event.id} className="flex items-center gap-3 py-3">
                    <div className={`flex items-center justify-center size-8 rounded-full ${EVENT_COLORS[event.type]}`}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {event.entityHref ? (
                          <Link href={event.entityHref} className="hover:underline">{event.title}</Link>
                        ) : (
                          event.title
                        )}
                      </div>
                      {event.entityName && (
                        <p className="text-xs text-muted-foreground">{event.entityName}</p>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{formatDate(event.date)}</div>
                    <Badge variant="outline" className="text-xs capitalize">{event.type}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {events.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">No events scheduled for {MONTH_NAMES[month]} {year}.</p>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded bg-blue-200 border border-blue-300" />
          Maintenance
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded bg-yellow-200 border border-yellow-300" />
          Repairs
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded bg-orange-200 border border-orange-300" />
          Warranty Expiry
        </div>
      </div>
    </div>
  );
}
