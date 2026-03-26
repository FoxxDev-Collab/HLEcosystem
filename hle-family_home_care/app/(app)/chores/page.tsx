import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { ChoreChart } from "@/components/chore-chart";

function getWeekStart(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDates(weekStart: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export default async function ChoresPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const params = await searchParams;
  const weekStart = getWeekStart(params.week);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekDates = getWeekDates(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [chores, completions] = await Promise.all([
    prisma.chore.findMany({
      where: { householdId, isActive: true },
      include: { room: { select: { name: true } } },
      orderBy: { title: "asc" },
    }),
    prisma.choreCompletion.findMany({
      where: {
        householdId,
        dueDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  // Get unique member IDs from completions
  const memberIds = [...new Set(completions.map((c) => c.completedById))];

  // Calculate point summaries for each member
  const pointSummaries = await Promise.all(
    memberIds.map(async (memberId) => {
      const memberName = completions.find((c) => c.completedById === memberId)?.completedByName || "Unknown";

      const earnedResult = await prisma.choreCompletion.aggregate({
        where: {
          householdId,
          completedById: memberId,
          status: "COMPLETED",
        },
        _sum: { pointsEarned: true },
      });
      const earned = earnedResult._sum.pointsEarned ?? 0;

      const spentResult = await prisma.rewardRedemption.aggregate({
        where: {
          householdId,
          redeemedById: memberId,
        },
        _sum: { pointsSpent: true },
      });
      const spent = spentResult._sum.pointsSpent ?? 0;

      return {
        memberId,
        memberName,
        earned,
        balance: earned - spent,
      };
    })
  );

  // Serialize dates for client component
  const serializedCompletions = completions.map((c) => ({
    id: c.id,
    choreId: c.choreId,
    completedById: c.completedById,
    completedByName: c.completedByName,
    dueDate: c.dueDate.toISOString().split("T")[0],
    completedDate: c.completedDate ? c.completedDate.toISOString().split("T")[0] : null,
    status: c.status,
    pointsEarned: c.pointsEarned,
    notes: c.notes,
  }));

  const serializedChores = chores.map((c) => ({
    id: c.id,
    title: c.title,
    pointValue: c.pointValue,
    frequency: c.frequency,
    estimatedMinutes: c.estimatedMinutes,
    room: c.room,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Chore Chart</h1>
      <ChoreChart
        weekStart={weekStartStr}
        weekDates={weekDates}
        chores={serializedChores}
        completions={serializedCompletions}
        pointSummaries={pointSummaries}
        hasCompletions={completions.length > 0}
      />
    </div>
  );
}
