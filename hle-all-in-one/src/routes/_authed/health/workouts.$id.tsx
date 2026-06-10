import { useState } from "react"
import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import {
  addExerciseFn,
  addSetFn,
  deleteExerciseFn,
  deleteSetFn,
  deleteWorkoutFn,
  getWorkoutFn,
} from "@/server/health/fns.workouts"
import type { SetType, WorkoutExerciseRow } from "@/server/health/workouts"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  durationMinutes,
  formIntOrNull,
  formNumOrNull,
  formStr,
  formatDuration,
  formatDurationSeconds,
  selectClass,
} from "@/components/health/health-shared"

export const Route = createFileRoute("/_authed/health/workouts/$id")({
  loader: async ({ params }) => {
    const data = await getWorkoutFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: WorkoutDetailPage,
})

const SET_TYPE_COLORS: Record<SetType, string> = {
  NORMAL: "",
  WARMUP: "text-yellow-600",
  FAILURE: "text-red-600",
  DROPSET: "text-purple-600",
}

function WorkoutDetailPage() {
  const { workout, exercises } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const duration = durationMinutes(workout.startTime, workout.endTime)
  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0)
  const totalVolume = exercises.reduce(
    (s, e) =>
      s +
      e.sets.reduce(
        (ss, set) => ss + (set.weightLbs ?? 0) * (set.reps ?? 0),
        0
      ),
    0
  )

  function refresh() {
    router.invalidate()
  }

  async function confirmDeleteWorkout() {
    setError(null)
    setDeleting(true)
    try {
      const result = await deleteWorkoutFn({ data: { id: workout.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setDeleting(false)
        return
      }
      navigate({ to: "/health/workouts" })
    } catch {
      setError("Could not delete workout.")
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            render={<Link to="/health/workouts" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{workout.title}</h1>
            <p className="text-sm text-muted-foreground">
              {workout.memberFirstName} · {formatDate(workout.startTime)}
              {duration !== null &&
                duration > 0 &&
                ` · ${formatDuration(duration)}`}
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmDelete(true)}
        >
          Delete Workout
        </Button>
      </div>

      {workout.description && (
        <p className="text-sm text-muted-foreground">{workout.description}</p>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Exercises" value={String(exercises.length)} />
        <StatCard label="Total Sets" value={String(totalSets)} />
        <StatCard
          label="Total Volume"
          value={`${totalVolume.toLocaleString()} lbs`}
        />
        <StatCard
          label="Duration"
          value={
            duration !== null && duration > 0 ? formatDuration(duration) : "—"
          }
        />
      </div>

      <AddExerciseCard workoutId={workout.id} onSaved={refresh} />

      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          onChanged={refresh}
        />
      ))}

      {exercises.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Add exercises above to build your workout.
          </CardContent>
        </Card>
      )}

      {confirmDelete && (
        <AlertDialog open onOpenChange={(o) => !o && setConfirmDelete(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {workout.title}?</AlertDialogTitle>
              <AlertDialogDescription>
                All exercises and sets in this workout are deleted with it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDelete(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  confirmDeleteWorkout()
                }}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function AddExerciseCard({
  workoutId,
  onSaved,
}: {
  workoutId: string
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await addExerciseFn({
        data: {
          workoutId,
          exerciseName: formStr(f, "exerciseName"),
          notes: formStr(f, "notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        form.reset()
        onSaved()
      }
    } catch {
      setError("Could not add exercise.")
    }
    setPending(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Exercise</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="ex-name">Exercise Name</Label>
            <Input
              id="ex-name"
              name="exerciseName"
              placeholder="e.g. Bench Press, Squat, 5K Run"
              required
            />
          </div>
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="ex-notes">Notes</Label>
            <Input id="ex-notes" name="notes" placeholder="Optional" />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add"}
          </Button>
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}

function ExerciseCard({
  exercise,
  onChanged,
}: {
  exercise: WorkoutExerciseRow
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function removeExercise() {
    setError(null)
    try {
      const result = await deleteExerciseFn({ data: { id: exercise.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not delete exercise.")
    }
  }

  async function removeSet(id: string) {
    setError(null)
    try {
      const result = await deleteSetFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not delete set.")
    }
  }

  async function onAddSet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const setType = formStr(f, "setType")
    try {
      const result = await addSetFn({
        data: {
          workoutExerciseId: exercise.id,
          setType:
            setType === "WARMUP" ||
            setType === "FAILURE" ||
            setType === "DROPSET"
              ? setType
              : "NORMAL",
          weightLbs: formNumOrNull(f, "weightLbs"),
          reps: formIntOrNull(f, "reps"),
          distanceMiles: formNumOrNull(f, "distanceMiles"),
          durationSeconds: formIntOrNull(f, "durationSeconds"),
          rpe: formNumOrNull(f, "rpe"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        form.reset()
        onChanged()
      }
    } catch {
      setError("Could not add set.")
    }
    setPending(false)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{exercise.exerciseName}</CardTitle>
            {exercise.notes && (
              <CardDescription>{exercise.notes}</CardDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="Delete exercise"
            onClick={removeExercise}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {exercise.sets.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 text-left">Set</th>
                  <th className="px-3 py-1.5 text-left">Type</th>
                  <th className="px-3 py-1.5 text-right">Weight</th>
                  <th className="px-3 py-1.5 text-right">Reps</th>
                  <th className="px-3 py-1.5 text-right">Distance</th>
                  <th className="px-3 py-1.5 text-right">Time</th>
                  <th className="px-3 py-1.5 text-right">RPE</th>
                  <th className="py-1.5 pl-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set, idx) => (
                  <tr key={set.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{idx + 1}</td>
                    <td
                      className={`px-3 py-1.5 text-xs ${SET_TYPE_COLORS[set.setType]}`}
                    >
                      {set.setType !== "NORMAL" && set.setType}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {set.weightLbs ? `${set.weightLbs} lbs` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {set.reps ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {set.distanceMiles ? `${set.distanceMiles} mi` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {set.durationSeconds
                        ? formatDurationSeconds(set.durationSeconds)
                        : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right">{set.rpe ?? "—"}</td>
                    <td className="py-1.5 pl-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        title="Delete set"
                        onClick={() => removeSet(set.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form
          onSubmit={onAddSet}
          className="flex flex-wrap items-end gap-2 border-t pt-2"
        >
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`set-type-${exercise.id}`}>
              Type
            </Label>
            <select
              id={`set-type-${exercise.id}`}
              name="setType"
              className={`${selectClass} h-8 w-24 text-xs`}
              defaultValue="NORMAL"
            >
              <option value="NORMAL">Normal</option>
              <option value="WARMUP">Warmup</option>
              <option value="FAILURE">Failure</option>
              <option value="DROPSET">Dropset</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`set-weight-${exercise.id}`}>
              Weight (lbs)
            </Label>
            <Input
              id={`set-weight-${exercise.id}`}
              name="weightLbs"
              type="number"
              step="0.5"
              min="0"
              className="h-8 w-20 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`set-reps-${exercise.id}`}>
              Reps
            </Label>
            <Input
              id={`set-reps-${exercise.id}`}
              name="reps"
              type="number"
              min="0"
              className="h-8 w-16 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`set-distance-${exercise.id}`}>
              Distance (mi)
            </Label>
            <Input
              id={`set-distance-${exercise.id}`}
              name="distanceMiles"
              type="number"
              step="0.01"
              min="0"
              className="h-8 w-20 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`set-time-${exercise.id}`}>
              Time (sec)
            </Label>
            <Input
              id={`set-time-${exercise.id}`}
              name="durationSeconds"
              type="number"
              min="0"
              className="h-8 w-20 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`set-rpe-${exercise.id}`}>
              RPE
            </Label>
            <Input
              id={`set-rpe-${exercise.id}`}
              name="rpe"
              type="number"
              step="0.5"
              min="1"
              max="10"
              className="h-8 w-16 text-sm"
            />
          </div>
          <Button type="submit" size="sm" className="h-8" disabled={pending}>
            <Plus className="size-3" /> Set
          </Button>
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
