import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ArrowLeft,
  Calendar,
  Dumbbell,
  Flame,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { getWorkoutStatsFn } from "@/server/health/fns.workouts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDuration } from "@/components/health/health-shared"

type StatsSearch = { memberId?: string }

export const Route = createFileRoute("/_authed/health/workouts/stats")({
  validateSearch: (search: Record<string, unknown>): StatsSearch =>
    typeof search.memberId === "string" && search.memberId
      ? { memberId: search.memberId }
      : {},
  loaderDeps: ({ search }) => ({ memberId: search.memberId ?? null }),
  loader: ({ deps }) =>
    getWorkoutStatsFn({ data: { memberId: deps.memberId } }),
  component: WorkoutStatsPage,
})

function WorkoutStatsPage() {
  const { members, stats, memberId } = Route.useLoaderData()
  const maxWeekly = Math.max(...stats.weekly.map((w) => w.count), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          render={<Link to="/health/workouts" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Workout Stats</h1>
          <p className="text-sm text-muted-foreground">
            Performance overview and personal records
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          label="Workouts"
          value={String(stats.totalWorkouts)}
          icon={<Dumbbell className="size-4" />}
        />
        <SummaryCard label="Exercises" value={String(stats.totalExercises)} />
        <SummaryCard label="Total Sets" value={String(stats.totalSets)} />
        <SummaryCard
          label="Volume"
          value={`${stats.totalVolume.toLocaleString()} lbs`}
          icon={<TrendingUp className="size-4" />}
        />
        <SummaryCard
          label="Avg Duration"
          value={
            stats.avgDurationMinutes > 0
              ? formatDuration(stats.avgDurationMinutes)
              : "--"
          }
        />
        <SummaryCard
          label="Streak"
          value={`${stats.streakDays} day${stats.streakDays !== 1 ? "s" : ""}`}
          icon={<Flame className="size-4" />}
        />
      </div>

      {members.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link to="/health/workouts/stats" search={{}}>
            <Badge
              variant={!memberId ? "default" : "outline"}
              className="cursor-pointer"
            >
              All
            </Badge>
          </Link>
          {members.map((m) => (
            <Link
              key={m.id}
              to="/health/workouts/stats"
              search={{ memberId: m.id }}
            >
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

      {stats.topExercises.length > 0 && (
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
                {stats.topExercises.map((e) => (
                  <TableRow key={e.name}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right">{e.count}</TableCell>
                    <TableCell className="text-right">{e.sets}</TableCell>
                    <TableCell className="text-right">
                      {e.volume > 0 ? `${e.volume.toLocaleString()} lbs` : "--"}
                    </TableCell>
                    <TableCell className="text-right">
                      {e.bestWeight > 0 ? `${e.bestWeight} lbs` : "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {stats.personalRecords.length > 0 && (
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
                {stats.personalRecords.map((pr) => (
                  <TableRow key={pr.name}>
                    <TableCell className="font-medium">{pr.name}</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" /> Monthly Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {stats.monthly.map((m) => (
              <Card key={m.label} className="bg-muted/30">
                <CardContent className="px-4 pt-4 pb-3">
                  <div className="text-sm font-medium text-muted-foreground">
                    {m.label}
                  </div>
                  <div className="mt-1 text-xl font-bold">
                    {m.workouts} workout{m.workouts !== 1 ? "s" : ""}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" /> Weekly Frequency (Last 12 Weeks)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.weekly.map((w) => (
              <div key={w.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">
                  {w.label}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                  {w.count > 0 && (
                    <div
                      className="flex h-full items-center justify-end rounded-full bg-primary pr-2"
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

      {stats.totalWorkouts === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No workout data yet. Start logging workouts to see your stats.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
