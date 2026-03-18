import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatDuration, formatDurationSeconds } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { addExerciseAction, deleteExerciseAction, addSetAction, deleteSetAction, deleteWorkoutAction } from "../actions";

const SET_TYPE_COLORS: Record<string, string> = {
  NORMAL: "",
  WARMUP: "text-yellow-600",
  FAILURE: "text-red-600",
  DROPSET: "text-purple-600",
};

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      familyMember: true,
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: { sets: { orderBy: { setIndex: "asc" } } },
      },
    },
  });
  if (!workout) notFound();

  const duration = workout.endTime
    ? Math.round((workout.endTime.getTime() - workout.startTime.getTime()) / 60000)
    : null;
  const totalSets = workout.exercises.reduce((s, e) => s + e.sets.length, 0);
  const totalVolume = workout.exercises.reduce(
    (s, e) => s + e.sets.reduce((ss, set) => ss + (Number(set.weightLbs || 0) * (set.reps || 0)), 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/workouts"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{workout.title}</h1>
            <p className="text-muted-foreground">
              {workout.familyMember.firstName} · {formatDate(workout.startTime)}
              {duration && ` · ${formatDuration(duration)}`}
            </p>
          </div>
        </div>
        <form action={deleteWorkoutAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="destructive" size="sm">Delete Workout</Button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Exercises</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{workout.exercises.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Sets</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalSets}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Volume</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalVolume.toLocaleString()} lbs</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Duration</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{duration ? formatDuration(duration) : "—"}</div></CardContent>
        </Card>
      </div>

      {/* Add Exercise */}
      <Card>
        <CardHeader><CardTitle>Add Exercise</CardTitle></CardHeader>
        <CardContent>
          <form action={addExerciseAction} className="flex gap-3 items-end">
            <input type="hidden" name="workoutId" value={id} />
            <div className="space-y-1 flex-1">
              <Label>Exercise Name</Label>
              <Input name="exerciseName" placeholder="e.g. Bench Press, Squat, 5K Run" required />
            </div>
            <div className="space-y-1 flex-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Optional" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Exercises */}
      {workout.exercises.map((exercise) => (
        <Card key={exercise.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{exercise.exerciseName}</CardTitle>
                {exercise.notes && <CardDescription>{exercise.notes}</CardDescription>}
              </div>
              <form action={deleteExerciseAction}>
                <input type="hidden" name="id" value={exercise.id} />
                <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                  <Trash2 className="size-3.5" />
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Sets Table */}
            {exercise.sets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-1.5 pr-3">Set</th>
                      <th className="text-left py-1.5 px-3">Type</th>
                      <th className="text-right py-1.5 px-3">Weight</th>
                      <th className="text-right py-1.5 px-3">Reps</th>
                      <th className="text-right py-1.5 px-3">Distance</th>
                      <th className="text-right py-1.5 px-3">Time</th>
                      <th className="text-right py-1.5 px-3">RPE</th>
                      <th className="text-right py-1.5 pl-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set, idx) => (
                      <tr key={set.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 font-medium">{idx + 1}</td>
                        <td className={`py-1.5 px-3 text-xs ${SET_TYPE_COLORS[set.setType] || ""}`}>
                          {set.setType !== "NORMAL" && set.setType}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {set.weightLbs ? `${Number(set.weightLbs)} lbs` : "—"}
                        </td>
                        <td className="py-1.5 px-3 text-right">{set.reps ?? "—"}</td>
                        <td className="py-1.5 px-3 text-right">
                          {set.distanceMiles ? `${Number(set.distanceMiles)} mi` : "—"}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {set.durationSeconds ? formatDurationSeconds(set.durationSeconds) : "—"}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {set.rpe ? Number(set.rpe) : "—"}
                        </td>
                        <td className="py-1.5 pl-3 text-right">
                          <form action={deleteSetAction}>
                            <input type="hidden" name="id" value={set.id} />
                            <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                              <Trash2 className="size-3" />
                            </Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Set */}
            <form action={addSetAction} className="flex flex-wrap gap-2 items-end pt-2 border-t">
              <input type="hidden" name="workoutExerciseId" value={exercise.id} />
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select name="setType" defaultValue="NORMAL">
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="WARMUP">Warmup</SelectItem>
                    <SelectItem value="FAILURE">Failure</SelectItem>
                    <SelectItem value="DROPSET">Dropset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weight (lbs)</Label>
                <Input name="weightLbs" type="number" step="0.5" className="h-8 w-20 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reps</Label>
                <Input name="reps" type="number" className="h-8 w-16 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Distance (mi)</Label>
                <Input name="distanceMiles" type="number" step="0.01" className="h-8 w-20 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time (sec)</Label>
                <Input name="durationSeconds" type="number" className="h-8 w-20 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RPE</Label>
                <Input name="rpe" type="number" step="0.5" min="1" max="10" className="h-8 w-16 text-sm" />
              </div>
              <Button type="submit" size="sm" className="h-8"><Plus className="size-3 mr-1" />Set</Button>
            </form>
          </CardContent>
        </Card>
      ))}

      {workout.exercises.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Add exercises above to build your workout.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
