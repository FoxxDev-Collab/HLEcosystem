import Link from "next/link";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DATE_TYPE_COLORS: Record<string, string> = {
  BIRTHDAY: "bg-blue-500",
  ANNIVERSARY: "bg-pink-500",
  GRADUATION: "bg-purple-500",
  MEMORIAL: "bg-gray-500",
  HOLIDAY: "bg-green-500",
  CUSTOM: "bg-orange-500",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const householdId = (await getCurrentHouseholdId())!;
  const now = new Date();
  const month = params.month ? parseInt(params.month) : now.getMonth();
  const year = params.year ? parseInt(params.year) : now.getFullYear();

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const dates = await prisma.importantDate.findMany({
    where: { householdId },
    include: { familyMember: true },
  });

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  // Map dates to day numbers for this month
  const dayEvents: Map<number, typeof dates> = new Map();
  for (const d of dates) {
    const dateObj = new Date(d.date);
    // For ANNUAL recurrence, check if the month/day matches
    if (d.recurrenceType === "ANNUAL") {
      if (dateObj.getMonth() === month) {
        const day = dateObj.getDate();
        if (!dayEvents.has(day)) dayEvents.set(day, []);
        dayEvents.get(day)!.push(d);
      }
    } else {
      // ONCE — check exact month/year
      if (dateObj.getMonth() === month && dateObj.getFullYear() === year) {
        const day = dateObj.getDate();
        if (!dayEvents.has(day)) dayEvents.set(day, []);
        dayEvents.get(day)!.push(d);
      }
    }
  }

  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calendar</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="icon">
              <Link href={`/calendar?month=${prevMonth}&year=${prevYear}`}>
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <CardTitle>{MONTH_NAMES[month]} {year}</CardTitle>
            <Button asChild variant="ghost" size="icon">
              <Link href={`/calendar?month=${nextMonth}&year=${nextYear}`}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {DAY_NAMES.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[80px] bg-muted/30 rounded p-1" />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const events = dayEvents.get(day) || [];
              const isToday = isCurrentMonth && today.getDate() === day;
              return (
                <div
                  key={day}
                  className={`min-h-[80px] border rounded p-1 ${isToday ? "bg-primary/5 border-primary" : ""}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-center gap-1">
                        <div className={`size-2 rounded-full shrink-0 ${DATE_TYPE_COLORS[event.type]}`} />
                        <span className="text-[10px] truncate">{event.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
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
  );
}
