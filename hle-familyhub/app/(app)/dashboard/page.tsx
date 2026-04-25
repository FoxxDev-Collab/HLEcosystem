import Link from "next/link";
import { getCurrentHouseholdId, getSpouseForUser, getHouseholdById } from "@/lib/household";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CalendarDays,
  Lightbulb,
  Gift,
  Heart,
  ArrowRight,
  ListTodo,
  Film,
  Plus,
  Stethoscope,
  Plane,
  Wrench,
  UtensilsCrossed,
  Clock,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";

// ── Cross-schema types ────────────────────────────────────────────────────────

type CrossHealthAppt = {
  id: string;
  appointmentDateTime: Date;
  appointmentType: string;
  status: string;
  location: string | null;
  firstName: string;
  lastName: string;
};

type CrossActiveTrip = {
  id: string;
  name: string;
  destination: string | null;
  daysLeft: number;
  dayTitle: string | null;
};

type CrossMaintenance = {
  id: string;
  title: string;
  nextDueDate: Date;
};

type CrossMealEntry = {
  entryType: string;
  title: string | null;
  recipeName: string | null;
};

function getNextOccurrence(date: Date): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(date);
  next.setFullYear(today.getFullYear());
  if (next < today) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return next;
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_COLORS: Record<string, string> = {
  IDEA: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PURCHASED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  WRAPPED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  GIVEN: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

export default async function DashboardPage() {
  const householdId = (await getCurrentHouseholdId())!;
  const user = await getCurrentUser();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    spouse, household, memberCount, importantDates, activeIdeas, giftsGiven,
    recentGifts, todoListCount, mediaRequestCount,
    todayAppointments, activeTrips, overdueMaintenace, todayMeals,
  ] = await Promise.all([
    user ? getSpouseForUser(householdId, user.id) : null,
    getHouseholdById(householdId),
    prisma.familyMember.count({ where: { householdId, isActive: true } }),
    prisma.importantDate.findMany({
      where: { householdId },
      include: { familyMember: true },
      orderBy: { date: "asc" },
    }),
    prisma.giftIdea.count({ where: { householdId, status: "ACTIVE" } }),
    prisma.gift.count({ where: { householdId, status: "GIVEN" } }),
    prisma.gift.findMany({
      where: { householdId },
      include: { familyMember: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.todoList.count({ where: { householdId } }),
    prisma.mediaRequest.count({ where: { status: "REQUESTED" } }),

    // Cross-schema: health appointments today
    prisma.$queryRaw<CrossHealthAppt[]>`
      SELECT a."id", a."appointmentDateTime", a."appointmentType", a."status", a."location",
             fm."firstName", fm."lastName"
      FROM family_health."Appointment" a
      JOIN family_health."FamilyMember" fm ON fm."id" = a."familyMemberId"
      WHERE fm."householdId" = ${householdId}
        AND a."appointmentDateTime" >= ${todayStart}
        AND a."appointmentDateTime" <= ${todayEnd}
        AND a."status" NOT IN ('CANCELLED', 'NO_SHOW')
      ORDER BY a."appointmentDateTime" ASC
    `,

    // Cross-schema: trips currently in progress
    prisma.$queryRaw<CrossActiveTrip[]>`
      SELECT t."id", t."name", t."destination",
             EXTRACT(DAY FROM t."endDate"::timestamp - CURRENT_TIMESTAMP)::int + 1 AS "daysLeft",
             d."title" as "dayTitle"
      FROM family_travel."Trip" t
      LEFT JOIN family_travel."ItineraryDay" d
        ON d."tripId" = t."id" AND d."date" = CURRENT_DATE
      WHERE t."householdId" = ${householdId}
        AND t."startDate" <= CURRENT_DATE
        AND t."endDate" >= CURRENT_DATE
        AND t."status"::text = 'IN_PROGRESS'
      LIMIT 1
    `,

    // Cross-schema: overdue/due-today maintenance
    prisma.$queryRaw<CrossMaintenance[]>`
      SELECT "id", "title", "nextDueDate"
      FROM family_home_care."MaintenanceSchedule"
      WHERE "householdId" = ${householdId}
        AND "isActive" = true
        AND "nextDueDate" IS NOT NULL
        AND "nextDueDate" <= CURRENT_DATE
      ORDER BY "nextDueDate" ASC
      LIMIT 5
    `,

    // Cross-schema: today's meal plan
    prisma.$queryRaw<{ data: { entryType: string; title: string | null; recipe: { name: string } | null } }[]>`
      SELECT "data"
      FROM meal_prep."CachedMealieMealPlan"
      WHERE "householdId" = ${householdId}
        AND "date" = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
      ORDER BY ("data"->>'entryType') ASC
    `,
  ]);

  const meals: CrossMealEntry[] = todayMeals.map((row) => ({
    entryType: row.data.entryType,
    title: row.data.title ?? null,
    recipeName: row.data.recipe?.name ?? null,
  }));

  const hasTodayData =
    todayAppointments.length > 0 ||
    activeTrips.length > 0 ||
    overdueMaintenace.length > 0 ||
    meals.length > 0;

  const upcomingEvents = importantDates
    .map((d) => {
      const nextDate = d.recurrenceType === "ANNUAL" ? getNextOccurrence(d.date) : d.date;
      const days = daysUntil(nextDate);
      return { ...d, nextDate, days };
    })
    .filter((d) => d.days >= 0 && d.days <= 30)
    .sort((a, b) => a.days - b.days);

  const upcomingAll = importantDates
    .map((d) => {
      const nextDate = d.recurrenceType === "ANNUAL" ? getNextOccurrence(d.date) : d.date;
      const days = daysUntil(nextDate);
      return { ...d, nextDate, days };
    })
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 10);

  const weddingDate = spouse
    ? importantDates.find(
        (d) => d.type === "ANNIVERSARY" && d.label.toLowerCase().includes("wedding"),
      )
    : null;

  const yearsMarried = weddingDate
    ? new Date().getFullYear() - new Date(weddingDate.date).getFullYear()
    : null;

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Today at a Glance */}
      {hasTodayData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              Today at a Glance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Active trip */}
            {activeTrips.map((trip) => {
              const travelUrl = process.env.NEXT_PUBLIC_APP_URL_TRAVEL ?? "http://localhost:8089";
              return (
                <a key={trip.id} href={`${travelUrl}/dashboard`} className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                  <Plane className="size-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{trip.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {trip.destination && `${trip.destination} · `}
                      {trip.dayTitle ? trip.dayTitle : "In progress"}
                      {trip.daysLeft > 0 && ` · ${trip.daysLeft}d left`}
                    </p>
                  </div>
                  <Badge variant="default" className="text-[10px] shrink-0">Traveling</Badge>
                </a>
              );
            })}

            {/* Health appointments */}
            {todayAppointments.map((appt) => (
              <div key={appt.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                <Stethoscope className="size-4 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {appt.firstName} {appt.lastName}
                    <span className="text-muted-foreground font-normal text-xs ml-1.5">
                      {appt.appointmentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(appt.appointmentDateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {appt.location && ` · ${appt.location}`}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">{appt.status}</Badge>
              </div>
            ))}

            {/* Today's meals */}
            {meals.length > 0 && (
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40">
                <UtensilsCrossed className="size-4 text-orange-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Today&apos;s Meals</p>
                  <div className="space-y-0.5">
                    {meals.map((meal, i) => (
                      <p key={i} className="text-sm">
                        <span className="text-muted-foreground text-xs capitalize">{meal.entryType}: </span>
                        {meal.recipeName ?? meal.title ?? "Planned"}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Overdue maintenance */}
            {overdueMaintenace.length > 0 && (
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-yellow-50/60 dark:bg-yellow-950/20">
                <Wrench className="size-4 text-yellow-700 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                    {overdueMaintenace.length} Overdue Maintenance Task{overdueMaintenace.length !== 1 ? "s" : ""}
                  </p>
                  {overdueMaintenace.slice(0, 3).map((task) => (
                    <p key={task.id} className="text-xs text-muted-foreground">{task.title}</p>
                  ))}
                  {overdueMaintenace.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{overdueMaintenace.length - 3} more</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Marriage hero card */}
      {spouse && (
        <Card className="marriage-card border-rose-200 dark:border-rose-800">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex items-center justify-center size-12 rounded-full bg-rose-100 dark:bg-rose-900/40">
              <Heart className="size-6 text-rose-500" fill="currentColor" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">
                {user?.name.split(" ")[0]} & {spouse.displayName.split(" ")[0]}
              </p>
              {weddingDate ? (
                <p className="text-sm text-muted-foreground">
                  Married {formatDateShort(weddingDate.date)}
                  {yearsMarried !== null && yearsMarried > 0 && (
                    <span> &middot; {yearsMarried} {yearsMarried === 1 ? "year" : "years"}</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Married &middot;{" "}
                  <a href="/dates" className="text-rose-600 hover:underline">
                    Add your wedding date
                  </a>
                </p>
              )}
            </div>
            <Badge variant="outline" className="border-rose-300 text-rose-700 dark:text-rose-300">
              {household?.name}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Summary stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card-accent" style={{ "--stat-color": "var(--primary)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">People</span>
              <Users className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{memberCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">family members</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.14 260)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Upcoming</span>
              <CalendarDays className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{upcomingEvents.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">next 30 days</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.65 0.16 80)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Gift Ideas</span>
              <Lightbulb className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{activeIdeas}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">active ideas</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.16 145)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Gifts Given</span>
              <Gift className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{giftsGiven}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">all time</p>
          </CardContent>
        </Card>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Left column — main content */}
        <div className="space-y-6 min-w-0">
          {/* Upcoming Events */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Upcoming Events</h2>
              </div>
              <Link
                href="/dates"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {upcomingAll.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No upcoming events.
                  </p>
                ) : (
                  <div className="divide-y">
                    {upcomingAll.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{event.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateShort(event.nextDate)}
                            {event.familyMember && ` - ${event.familyMember.firstName} ${event.familyMember.lastName}`}
                          </p>
                        </div>
                        <Badge
                          variant={event.days === 0 ? "destructive" : "secondary"}
                          className="text-[10px] shrink-0 ml-3"
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

          {/* Recent Gift Activity */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gift className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Recent Gifts</h2>
              </div>
              <Link
                href="/gifts"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {recentGifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No gifts recorded yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recentGifts.map((gift) => (
                      <div
                        key={gift.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{gift.description}</p>
                          <p className="text-xs text-muted-foreground">
                            For {gift.familyMember.firstName} {gift.familyMember.lastName}
                            {gift.occasion && ` - ${gift.occasion}`}
                          </p>
                        </div>
                        <Badge className={`${STATUS_COLORS[gift.status]} text-[10px] shrink-0 ml-3`}>
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

        {/* Right column — sidebar */}
        <div className="space-y-6">
          {/* Family overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Family</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Link
                href="/people"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  <span>People</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{memberCount}</span>
              </Link>
              <Link
                href="/dates"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <span>Events</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{importantDates.length}</span>
              </Link>
              <Link
                href="/gift-ideas"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Lightbulb className="size-4 text-muted-foreground" />
                  <span>Gift Ideas</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{activeIdeas}</span>
              </Link>
              <Link
                href="/todos"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <ListTodo className="size-4 text-muted-foreground" />
                  <span>To-Do Lists</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{todoListCount}</span>
              </Link>
              {mediaRequestCount > 0 && (
                <Link
                  href="/media-requests"
                  className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <Film className="size-4 text-muted-foreground" />
                    <span>Pending Requests</span>
                  </div>
                  <Badge variant="destructive" className="text-[9px]">{mediaRequestCount}</Badge>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link
                href="/people"
                className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors"
              >
                <Plus className="size-3.5" />
                Add person
              </Link>
              <Link
                href="/gift-ideas"
                className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors"
              >
                <Lightbulb className="size-3.5" />
                New gift idea
              </Link>
              <Link
                href="/dates"
                className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors"
              >
                <CalendarDays className="size-3.5" />
                Add important date
              </Link>
              <Link
                href="/todos"
                className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors"
              >
                <ListTodo className="size-3.5" />
                Create to-do list
              </Link>
              <Link
                href="/family-tree"
                className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors"
              >
                <Users className="size-3.5" />
                View family tree
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
