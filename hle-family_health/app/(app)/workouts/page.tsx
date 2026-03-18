import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatDuration } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Dumbbell, BarChart3, Upload } from "lucide-react";
import { createWorkoutAction } from "./actions";

export default async function WorkoutsPage({
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
    prisma.familyMember.findMany({ where: { householdId, isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.workout.findMany({
      where: { familyMember: { householdId }, ...memberFilter },
      include: {
        familyMember: true,
        exercises: { include: { sets: true } },
      },
      orderBy: { startTime: "desc" },
      take: 50,
    }),
  ]);

  // Stats
  const totalWorkouts = workouts.length;
  const thisWeek = workouts.filter((w) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return w.startTime >= weekAgo;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workouts</h1>
          <p className="text-muted-foreground">{thisWeek} this week · {totalWorkouts} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/workouts/stats"><BarChart3 className="size-4 mr-2" />Stats</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/workouts/import"><Upload className="size-4 mr-2" />Import</Link>
          </Button>
        </div>
      </div>

      {/* Member filter */}
      {members.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <a href="/workouts">
            <Badge variant={!params.memberId ? "default" : "outline"} className="cursor-pointer">All</Badge>
          </a>
          {members.map((m) => (
            <a key={m.id} href={`/workouts?memberId=${m.id}`}>
              <Badge variant={params.memberId === m.id ? "default" : "outline"} className="cursor-pointer">
                {m.firstName}
              </Badge>
            </a>
          ))}
        </div>
      )}

      {/* New Workout */}
      <Card>
        <CardHeader><CardTitle>Log Workout</CardTitle></CardHeader>
        <CardContent>
          <form action={createWorkoutAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-1">
              <Label>Who</Label>
              <Select name="familyMemberId" defaultValue={params.memberId || members[0]?.id} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.firstName}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input name="title" placeholder="e.g. Upper Body, Run" required />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
            <div className="space-y-1">
              <Label>Start Time</Label>
              <Input name="startTime" type="time" defaultValue="08:00" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Log Workout</Button>
          </form>
        </CardContent>
      </Card>

      {/* Workout List */}
      {workouts.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No workouts logged yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => {
            const duration = w.endTime
              ? Math.round((w.endTime.getTime() - w.startTime.getTime()) / 60000)
              : null;
            const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0);
            const totalVolume = w.exercises.reduce(
              (s, e) => s + e.sets.reduce((ss, set) => ss + (Number(set.weightLbs || 0) * (set.reps || 0)), 0),
              0
            );

            return (
              <Link key={w.id} href={`/workouts/${w.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Dumbbell className="size-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{w.title}</span>
                            <Badge variant="secondary" className="text-xs">{w.familyMember.firstName}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(w.startTime)}
                            {duration && ` · ${formatDuration(duration)}`}
                            {` · ${w.exercises.length} exercises · ${totalSets} sets`}
                            {totalVolume > 0 && ` · ${totalVolume.toLocaleString()} lbs`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
