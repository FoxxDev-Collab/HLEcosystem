import { useState } from "react"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  SkipForward,
  Sparkles,
  Trophy,
  X,
} from "lucide-react"
import {
  completeChoreFn,
  generateWeekChoresFn,
  getChoreChartFn,
  skipChoreFn,
} from "@/server/home-care/fns.chores"
import type { ChoreCompletionRow } from "@/server/home-care/chores"
import { formatDateShort } from "@/lib/format"
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const Route = createFileRoute("/_authed/home-care/chores/")({
  validateSearch: (search: Record<string, unknown>): { week?: string } => ({
    week:
      typeof search.week === "string" && DATE_RE.test(search.week)
        ? search.week
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ week: search.week ?? null }),
  loader: ({ deps }) => getChoreChartFn({ data: { week: deps.week } }),
  component: ChoreChartPage,
})

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d + days)
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${dt.getFullYear()}-${mm}-${dd}`
}

function todayStr(): string {
  const t = new Date()
  const mm = String(t.getMonth() + 1).padStart(2, "0")
  const dd = String(t.getDate()).padStart(2, "0")
  return `${t.getFullYear()}-${mm}-${dd}`
}

function statusColor(status: ChoreCompletionRow["status"]): string {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "SKIPPED":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400"
    case "MISSED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  }
}

function StatusIcon({ status }: { status: ChoreCompletionRow["status"] }) {
  switch (status) {
    case "COMPLETED":
      return <Check className="size-3.5" />
    case "SKIPPED":
      return <SkipForward className="size-3.5" />
    case "MISSED":
      return <X className="size-3.5" />
    default:
      return <Clock className="size-3.5" />
  }
}

function ChoreChartPage() {
  const { weekStart, weekDates, chores, completions, pointSummaries } =
    Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const today = todayStr()

  function goToWeek(week: string) {
    navigate({ to: "/home-care/chores", search: { week } })
  }

  async function runMutation(
    fn: () => Promise<{ error: string } | { ok: true }>
  ) {
    setError(null)
    try {
      const result = await fn()
      if ("error" in result) {
        setError(result.error)
        return
      }
      router.invalidate()
    } catch {
      setError("Something went wrong. Please try again.")
    }
  }

  function getCompletion(choreId: string, date: string) {
    return completions.find((c) => c.choreId === choreId && c.dueDate === date)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Chore Chart</h1>
        <p className="text-sm text-muted-foreground">
          Weekly chores, who they&apos;re assigned to, and points earned.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToWeek(addDays(weekStart, -7))}
        >
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-semibold">
            {formatDateShort(weekDates[0])} – {formatDateShort(weekDates[6])}
          </h2>
          <Button
            variant="link"
            size="sm"
            className="text-xs"
            onClick={() => goToWeek(today)}
          >
            Today
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToWeek(addDays(weekStart, 7))}
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {completions.length === 0 && chores.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4" />
                <span>No chores generated for this week yet.</span>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  runMutation(() =>
                    generateWeekChoresFn({ data: { weekStart } })
                  )
                }
              >
                Generate This Week
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {chores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="mx-auto mb-3 size-10 opacity-40" />
            <p>No chores defined yet. Go to Manage Chores to add some.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[160px] bg-background">
                      Chore
                    </TableHead>
                    {weekDates.map((date, i) => (
                      <TableHead
                        key={date}
                        className={`min-w-[100px] text-center ${date === today ? "bg-primary/5" : ""}`}
                      >
                        <div className="font-medium">{DAY_NAMES[i]}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {formatDateShort(date)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chores.map((chore) => (
                    <TableRow key={chore.id}>
                      <TableCell className="sticky left-0 z-10 bg-background font-medium">
                        <div>{chore.title}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {chore.roomName && (
                            <span className="text-xs text-muted-foreground">
                              {chore.roomName}
                            </span>
                          )}
                          {chore.pointValue > 0 && (
                            <Badge
                              variant="secondary"
                              className="px-1 py-0 text-xs"
                            >
                              {chore.pointValue}pts
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {weekDates.map((date) => {
                        const completion = getCompletion(chore.id, date)
                        return (
                          <TableCell
                            key={date}
                            className={`p-1 text-center ${date === today ? "bg-primary/5" : ""}`}
                          >
                            {completion ? (
                              <div
                                className={`inline-flex flex-col items-center gap-0.5 rounded-md px-2 py-1 ${statusColor(completion.status)}`}
                                title={[
                                  `${completion.completedByName} — ${completion.status}`,
                                  completion.pointsEarned > 0
                                    ? `+${completion.pointsEarned} points`
                                    : "",
                                  completion.notes ?? "",
                                ]
                                  .filter(Boolean)
                                  .join("\n")}
                              >
                                <StatusIcon status={completion.status} />
                                <span className="max-w-[80px] truncate text-[10px] leading-tight">
                                  {completion.completedByName}
                                </span>
                                {completion.status === "PENDING" && (
                                  <div className="mt-0.5 flex gap-0.5">
                                    <button
                                      type="button"
                                      className="rounded p-0.5 hover:bg-green-200 dark:hover:bg-green-800"
                                      title="Complete"
                                      onClick={() =>
                                        runMutation(() =>
                                          completeChoreFn({
                                            data: {
                                              completionId: completion.id,
                                              notes: "",
                                            },
                                          })
                                        )
                                      }
                                    >
                                      <Check className="size-3 text-green-700 dark:text-green-400" />
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
                                      title="Skip"
                                      onClick={() =>
                                        runMutation(() =>
                                          skipChoreFn({
                                            data: {
                                              completionId: completion.id,
                                              notes: "",
                                            },
                                          })
                                        )
                                      }
                                    >
                                      <SkipForward className="size-3 text-gray-600 dark:text-gray-400" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">
                                -
                              </span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {pointSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Points Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[...pointSummaries]
                .sort((a, b) => b.earned - a.earned)
                .map((summary, idx) => (
                  <div
                    key={summary.memberId ?? "unassigned"}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        idx === 0
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : idx === 1
                            ? "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400"
                            : idx === 2
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "bg-primary/10 text-primary"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {summary.memberName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {summary.earned} earned / {summary.balance} available
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
