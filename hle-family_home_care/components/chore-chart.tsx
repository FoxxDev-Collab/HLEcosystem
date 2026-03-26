"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  SkipForward,
  Clock,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  completeChoreAction,
  skipChoreAction,
  generateWeekChoresAction,
} from "@/app/(app)/chores/actions";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ChoreCompletion = {
  id: string;
  choreId: string;
  completedById: string;
  completedByName: string;
  dueDate: string;
  completedDate: string | null;
  status: "PENDING" | "COMPLETED" | "SKIPPED" | "MISSED";
  pointsEarned: number;
  notes: string | null;
};

type ChoreData = {
  id: string;
  title: string;
  pointValue: number;
  frequency: string;
  estimatedMinutes: number | null;
  room: { name: string } | null;
};

type PointSummary = {
  memberId: string;
  memberName: string;
  earned: number;
  balance: number;
};

type Props = {
  weekStart: string;
  weekDates: string[];
  chores: ChoreData[];
  completions: ChoreCompletion[];
  pointSummaries: PointSummary[];
  hasCompletions: boolean;
};

function getStatusColor(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "SKIPPED":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400";
    case "MISSED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-50 dark:bg-gray-900/20";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "COMPLETED":
      return <Check className="size-3.5" />;
    case "SKIPPED":
      return <SkipForward className="size-3.5" />;
    case "MISSED":
      return <X className="size-3.5" />;
    default:
      return <Clock className="size-3.5" />;
  }
}

function formatWeekDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
}

export function ChoreChart({
  weekStart,
  weekDates,
  chores,
  completions,
  pointSummaries,
  hasCompletions,
}: Props) {
  const router = useRouter();

  const prevWeek = new Date(weekStart + "T12:00:00");
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart + "T12:00:00");
  nextWeek.setDate(nextWeek.getDate() + 7);

  const prevWeekStr = prevWeek.toISOString().split("T")[0];
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  function getCompletion(choreId: string, dateStr: string): ChoreCompletion | undefined {
    return completions.find(
      (c) => c.choreId === choreId && c.dueDate === dateStr
    );
  }

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/chores?week=${prevWeekStr}`)}
        >
          <ChevronLeft className="size-4 mr-1" /> Previous
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-semibold">
            {formatWeekDate(weekDates[0])} - {formatWeekDate(weekDates[6])}
          </h2>
          <Button
            variant="link"
            size="sm"
            className="text-xs"
            onClick={() => {
              const today = new Date();
              const dayOfWeek = today.getDay();
              const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
              const monday = new Date(today);
              monday.setDate(today.getDate() + mondayOffset);
              router.push(`/chores?week=${monday.toISOString().split("T")[0]}`);
            }}
          >
            Today
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/chores?week=${nextWeekStr}`)}
        >
          Next <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>

      {/* Generate Button */}
      {!hasCompletions && chores.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
                <Sparkles className="size-4" />
                <span>No chores generated for this week yet.</span>
              </div>
              <form action={generateWeekChoresAction}>
                <input type="hidden" name="weekStart" value={weekStart} />
                <Button type="submit" size="sm">
                  Generate This Week
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chore Chart Grid */}
      {chores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="size-10 mx-auto mb-3 opacity-40" />
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
                    <TableHead className="min-w-[160px] sticky left-0 bg-background z-10">
                      Chore
                    </TableHead>
                    {weekDates.map((date, i) => (
                      <TableHead
                        key={date}
                        className={`text-center min-w-[100px] ${isToday(date) ? "bg-primary/5" : ""}`}
                      >
                        <div className="font-medium">{DAY_NAMES[i]}</div>
                        <div className="text-xs text-muted-foreground font-normal">
                          {formatWeekDate(date)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chores.map((chore) => (
                    <TableRow key={chore.id}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        <div>{chore.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {chore.room && (
                            <span className="text-xs text-muted-foreground">{chore.room.name}</span>
                          )}
                          {chore.pointValue > 0 && (
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              {chore.pointValue}pts
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {weekDates.map((date) => {
                        const completion = getCompletion(chore.id, date);
                        return (
                          <TableCell
                            key={date}
                            className={`text-center p-1 ${isToday(date) ? "bg-primary/5" : ""}`}
                          >
                            {completion ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`inline-flex flex-col items-center gap-0.5 rounded-md px-2 py-1 ${getStatusColor(completion.status)}`}
                                    >
                                      {getStatusIcon(completion.status)}
                                      <span className="text-[10px] leading-tight truncate max-w-[80px]">
                                        {completion.completedByName}
                                      </span>
                                      {completion.status === "PENDING" && (
                                        <div className="flex gap-0.5 mt-0.5">
                                          <form action={completeChoreAction}>
                                            <input type="hidden" name="completionId" value={completion.id} />
                                            <button
                                              type="submit"
                                              className="p-0.5 rounded hover:bg-green-200 dark:hover:bg-green-800"
                                              title="Complete"
                                            >
                                              <Check className="size-3 text-green-700 dark:text-green-400" />
                                            </button>
                                          </form>
                                          <form action={skipChoreAction}>
                                            <input type="hidden" name="completionId" value={completion.id} />
                                            <button
                                              type="submit"
                                              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                              title="Skip"
                                            >
                                              <SkipForward className="size-3 text-gray-600 dark:text-gray-400" />
                                            </button>
                                          </form>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{completion.completedByName} - {completion.status}</p>
                                    {completion.pointsEarned > 0 && (
                                      <p className="text-xs">+{completion.pointsEarned} points</p>
                                    )}
                                    {completion.notes && (
                                      <p className="text-xs mt-1">{completion.notes}</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Points Summary */}
      {pointSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Points Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pointSummaries
                .sort((a, b) => b.earned - a.earned)
                .map((summary, idx) => (
                  <div
                    key={summary.memberId}
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
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{summary.memberName}</div>
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
  );
}
