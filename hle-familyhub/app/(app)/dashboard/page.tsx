import { getCurrentHouseholdId, getSpouseForUser, getHouseholdById } from "@/lib/household";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarDays, Lightbulb, Gift, Heart } from "lucide-react";
import { formatDateShort } from "@/lib/format";

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
  IDEA: "bg-gray-100 text-gray-700",
  PURCHASED: "bg-blue-100 text-blue-700",
  WRAPPED: "bg-yellow-100 text-yellow-700",
  GIVEN: "bg-green-100 text-green-700",
};

export default async function DashboardPage() {
  const householdId = (await getCurrentHouseholdId())!;
  const user = await getCurrentUser();

  const [spouse, household, memberCount, importantDates, activeIdeas, giftsGiven, recentGifts] = await Promise.all([
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
  ]);

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {spouse && (
        <Card className="border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 dark:border-rose-800">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">People</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
            <CalendarDays className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingEvents.length}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Gift Ideas</CardTitle>
            <Lightbulb className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeIdeas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Gifts Given</CardTitle>
            <Gift className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{giftsGiven}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAll.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            ) : (
              <div className="space-y-3">
                {upcomingAll.map((event) => (
                  <div key={event.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(event.nextDate)}
                        {event.familyMember && ` - ${event.familyMember.firstName} ${event.familyMember.lastName}`}
                      </p>
                    </div>
                    <Badge variant={event.days === 0 ? "destructive" : "secondary"}>
                      {event.days === 0 ? "Today!" : `${event.days} days`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Gift Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentGifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gifts recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentGifts.map((gift) => (
                  <div key={gift.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{gift.description}</p>
                      <p className="text-xs text-muted-foreground">
                        For {gift.familyMember.firstName} {gift.familyMember.lastName}
                        {gift.occasion && ` - ${gift.occasion}`}
                      </p>
                    </div>
                    <Badge className={STATUS_COLORS[gift.status]}>{gift.status}</Badge>
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
