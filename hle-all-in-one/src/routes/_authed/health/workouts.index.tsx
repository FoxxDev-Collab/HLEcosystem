import { useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { BarChart3, Dumbbell, Plus, Trash2, Upload } from "lucide-react"
import {
  createWorkoutFn,
  deleteWorkoutFn,
  getWorkoutsPageFn,
} from "@/server/health/fns.workouts"
import type {
  HealthMemberOption,
  WorkoutListRow,
} from "@/server/health/workouts"
import { formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  formStr,
  formatDuration,
  selectClass,
} from "@/components/health/health-shared"

type WorkoutsSearch = { memberId?: string }

export const Route = createFileRoute("/_authed/health/workouts/")({
  validateSearch: (search: Record<string, unknown>): WorkoutsSearch =>
    typeof search.memberId === "string" && search.memberId
      ? { memberId: search.memberId }
      : {},
  loaderDeps: ({ search }) => ({ memberId: search.memberId ?? null }),
  loader: ({ deps }) =>
    getWorkoutsPageFn({ data: { memberId: deps.memberId } }),
  component: WorkoutsPage,
})

function WorkoutsPage() {
  const { members, workouts, memberId } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<WorkoutListRow | null>(null)

  // Legacy header stat: workouts in the last 7 days (of the listed page).
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const thisWeek = workouts.filter(
    (w) => new Date(w.startTime) >= weekAgo
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Workouts</h1>
          <p className="text-sm text-muted-foreground">
            {thisWeek} this week · {workouts.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link to="/health/workouts/stats" />}
          >
            <BarChart3 className="size-4" /> Stats
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link to="/health/workouts/import" />}
          >
            <Upload className="size-4" /> Import
          </Button>
        </div>
      </div>

      {members.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link to="/health/workouts" search={{}}>
            <Badge
              variant={!memberId ? "default" : "outline"}
              className="cursor-pointer"
            >
              All
            </Badge>
          </Link>
          {members.map((m) => (
            <Link key={m.id} to="/health/workouts" search={{ memberId: m.id }}>
              <Badge
                variant={memberId === m.id ? "default" : "outline"}
                className="cursor-pointer"
              >
                {m.firstName}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      <LogWorkoutCard members={members} defaultMemberId={memberId} />

      {workouts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Dumbbell className="mx-auto mb-3 size-10 opacity-40" />
            <p>No workouts logged yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => {
            const duration = durationMinutes(w.startTime, w.endTime)
            return (
              <Card key={w.id} className="transition-colors hover:bg-accent/50">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      to="/health/workouts/$id"
                      params={{ id: w.id }}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <Dumbbell className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{w.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {w.memberFirstName}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(w.startTime)}
                          {duration !== null &&
                            duration > 0 &&
                            ` · ${formatDuration(duration)}`}
                          {` · ${w.exerciseCount} exercises · ${w.setCount} sets`}
                          {w.totalVolume > 0 &&
                            ` · ${w.totalVolume.toLocaleString()} lbs`}
                        </div>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      title="Delete workout"
                      onClick={() => setDeleteTarget(w)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <DeleteWorkoutDialog
          workout={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function LogWorkoutCard({
  members,
  defaultMemberId,
}: {
  members: Array<HealthMemberOption>
  defaultMemberId: string | null
}) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createWorkoutFn({
        data: {
          memberId: formStr(f, "memberId"),
          title: formStr(f, "title"),
          date: formStr(f, "date"),
          startTime: formStr(f, "startTime") || "08:00",
          description: "",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      // Legacy redirects straight to the new workout to add exercises.
      navigate({ to: "/health/workouts/$id", params: { id: result.id } })
    } catch {
      setError("Could not log workout.")
      setPending(false)
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Enable health tracking for a family member first to log workouts.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log Workout</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="space-y-1">
            <Label htmlFor="workout-member">Who</Label>
            <select
              id="workout-member"
              name="memberId"
              className={selectClass}
              defaultValue={defaultMemberId ?? members[0]?.id}
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="workout-title">Title</Label>
            <Input
              id="workout-title"
              name="title"
              placeholder="e.g. Upper Body, Run"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="workout-date">Date</Label>
            <Input
              id="workout-date"
              name="date"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="workout-start">Start Time</Label>
            <Input
              id="workout-start"
              name="startTime"
              type="time"
              defaultValue="08:00"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Logging…" : "Log Workout"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-5">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteWorkoutDialog({
  workout,
  onClose,
  onDeleted,
}: {
  workout: WorkoutListRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteWorkoutFn({ data: { id: workout.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete workout.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {workout.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            All exercises and sets in this workout are deleted with it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
