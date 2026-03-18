import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDuration } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Dumbbell, Trophy, Flame, TrendingUp, Calendar } from "lucide-react";

export default async function WorkoutStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const memberFilter = params.memberId ? { familyMemberId: params.memberId } : {};

  const [members, workouts] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId, isActive: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.workout.findMany({
      where: { familyMember: { householdId }, ...memberFilter },
      include: {
        familyMember: true,
        exercises: { include: { sets: true } },
      },
      orderBy: { startTime: "desc" },
    }),
  ]);

  // Summary calculations
  const totalWorkouts = workouts.length;
  const totalExercises = workouts.reduce((s, w) => s + w.exercises.length, 0);
  const totalSets = workouts.reduce(
    (s, w) => s + w.exercises.reduce((es, e) => es + e.sets.length, 0),
    0,
  );
  const totalVolume = workouts.reduce(
    (s, w) =>
      s +
      w.exercises.reduce(
        (es, e) =>
          es +
          e.sets.reduce(
            (ss, set) => ss + Number(set.weightLbs || 0) * (set.reps || 0),
            0,
          ),
        0,
      ),
    0,
  );

  // Average duration (minutes)
  const workoutsWithDuration = workouts.filter((w) => w.endTime);
  const avgDuration =
    workoutsWithDuration.length > 0
      ? Math.round(
          workoutsWithDuration.reduce(
            (s, w) =>
              s +
              (w.endTime!.getTime() - w.startTime.getTime()) / 60000,
            0,
          ) / workoutsWithDuration.length,
        )
      : 0;

  // Current streak: consecutive days with at least one workout ending today
  const workoutDates = [
    ...new Set(
      workouts.map((w) => w.startTime.toISOString().split("T")[0]),
    ),
  ].sort((a, b) => b.localeCompare(a));

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < workoutDates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];
    if (workoutDates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  // Top exercises
  const exerciseMap = new Map<
    string,
    { count: number; sets: number; volume: number; bestWeight: number }
  >();
  for (const w of workouts) {
    for (const e of w.exercises) {
      const key = e.exerciseName;
      const entry = exerciseMap.get(key) || {
        count: 0,
        sets: 0,
        volume: 0,
        bestWeight: 0,
      };
      entry.count++;
      entry.sets += e.sets.length;
      for (const set of e.sets) {
        const weight = Number(set.weightLbs || 0);
        const reps = set.reps || 0;
        entry.volume += weight * reps;
        if (weight > entry.bestWeight) entry.bestWeight = weight;
      }
      exerciseMap.set(key, entry);
    }
  }
  const topExercises = [...exerciseMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  // Personal records
  const prMap = new Map<
    string,
    {
      heaviestWeight: number;
      heaviestReps: number;
      highestVolume: number;
      highestVolumeWeight: number;
      highestVolumeReps: number;
      mostReps: number;
      mostRepsWeight: number;
    }
  >();
  for (const w of workouts) {
    for (const e of w.exercises) {
      for (const set of e.sets) {
        const weight = Number(set.weightLbs || 0);
        const reps = set.reps || 0;
        if (weight === 0) continue;
        const key = e.exerciseName;
        const entry = prMap.get(key) || {
          heaviestWeight: 0,
          heaviestReps: 0,
          highestVolume: 0,
          highestVolumeWeight: 0,
          highestVolumeReps: 0,
          mostReps: 0,
          mostRepsWeight: 0,
        };
        if (weight > entry.heaviestWeight) {
          entry.heaviestWeight = weight;
          entry.heaviestReps = reps;
        }
        const vol = weight * reps;
        if (vol > entry.highestVolume) {
          entry.highestVolume = vol;
          entry.highestVolumeWeight = weight;
          entry.highestVolumeReps = reps;
        }
        if (reps > entry.mostReps) {
          entry.mostReps = reps;
          entry.mostRepsWeight = weight;
        }
        prMap.set(key, entry);
      }
    }
  }
  const personalRecords = [...prMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  // Monthly activity (last 6 months)
  const monthlyData: {
    label: string;
    workouts: number;
    volume: number;
    avgDuration: number;
  }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    const monthWorkouts = workouts.filter((w) => {
      const ws = w.startTime;
      return ws.getFullYear() === year && ws.getMonth() === month;
    });
    const monthVolume = monthWorkouts.reduce(
      (s, w) =>
        s +
        w.exercises.reduce(
          (es, e) =>
            es +
            e.sets.reduce(
              (ss, set) =>
                ss + Number(set.weightLbs || 0) * (set.reps || 0),
              0,
            ),
          0,
        ),
      0,
    );
    const withDur = monthWorkouts.filter((w) => w.endTime);
    const mAvg =
      withDur.length > 0
        ? Math.round(
            withDur.reduce(
              (s, w) =>
                s +
                (w.endTime!.getTime() - w.startTime.getTime()) / 60000,
              0,
            ) / withDur.length,
          )
        : 0;
    monthlyData.push({
      label,
      workouts: monthWorkouts.length,
      volume: monthVolume,
      avgDuration: mAvg,
    });
  }

  // Weekly frequency (last 12 weeks)
  const weeklyData: { label: string; count: number }[] = [];
  let maxWeekly = 0;
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = workouts.filter(
      (w) => w.startTime >= weekStart && w.startTime < weekEnd,
    ).length;
    if (count > maxWeekly) maxWeekly = count;
    const label = weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    weeklyData.push({ label, count });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workouts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workout Stats</h1>
          <p className="text-muted-foreground">
            Performance overview and personal records
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Dumbbell className="size-4" /> Workouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWorkouts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exercises</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExercises}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Sets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4" /> Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalVolume.toLocaleString()} lbs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgDuration > 0 ? formatDuration(avgDuration) : "--"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="size-4" /> Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {streak} day{streak !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Filter */}
      {members.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <a href="/workouts/stats">
            <Badge
              variant={!params.memberId ? "default" : "outline"}
              className="cursor-pointer"
            >
              All
            </Badge>
          </a>
          {members.map((m) => (
            <a key={m.id} href={`/workouts/stats?memberId=${m.id}`}>
              <Badge
                variant={params.memberId === m.id ? "default" : "outline"}
                className="cursor-pointer"
              >
                {m.firstName}
              </Badge>
            </a>
          ))}
        </div>
      )}

      {/* Top Exercises */}
      {topExercises.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="size-5" /> Top Exercises
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercise</TableHead>
                  <TableHead className="text-right">Times</TableHead>
                  <TableHead className="text-right">Sets</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Best Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topExercises.map(([name, data]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">{data.count}</TableCell>
                    <TableCell className="text-right">{data.sets}</TableCell>
                    <TableCell className="text-right">
                      {data.volume > 0
                        ? `${data.volume.toLocaleString()} lbs`
                        : "--"}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.bestWeight > 0 ? `${data.bestWeight} lbs` : "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Personal Records */}
      {personalRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-5" /> Personal Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercise</TableHead>
                  <TableHead className="text-right">Heaviest</TableHead>
                  <TableHead className="text-right">Best Volume Set</TableHead>
                  <TableHead className="text-right">Most Reps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personalRecords.map(([name, pr]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">
                      {pr.heaviestWeight} lbs x {pr.heaviestReps}
                    </TableCell>
                    <TableCell className="text-right">
                      {pr.highestVolumeWeight} lbs x {pr.highestVolumeReps} ={" "}
                      {pr.highestVolume.toLocaleString()} lbs
                    </TableCell>
                    <TableCell className="text-right">
                      {pr.mostReps} @ {pr.mostRepsWeight} lbs
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Monthly Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" /> Monthly Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {monthlyData.map((m) => (
              <Card key={m.label} className="bg-muted/30">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    {m.label}
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {m.workouts} workout{m.workouts !== 1 ? "s" : ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <div>{m.volume.toLocaleString()} lbs volume</div>
                    <div>
                      {m.avgDuration > 0
                        ? `${formatDuration(m.avgDuration)} avg`
                        : "No duration data"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workout Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" /> Weekly Frequency (Last 12 Weeks)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {weeklyData.map((w) => (
              <div key={w.label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16 shrink-0">
                  {w.label}
                </span>
                <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                  {w.count > 0 && (
                    <div
                      className="bg-primary h-full rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${Math.max((w.count / (maxWeekly || 1)) * 100, 12)}%`,
                      }}
                    >
                      <span className="text-xs font-medium text-primary-foreground">
                        {w.count}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {totalWorkouts === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No workout data yet. Start logging workouts to see your stats.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
