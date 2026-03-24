import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import {
  getMealPlan,
  getMealieConfig,
  getMonthRange,
  getMealieRecipeUrl,
} from "@/lib/mealie";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChefHat,
  Calendar,
  ShoppingCart,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Settings,
  Utensils,
} from "lucide-react";
// Sync actions now go through the review page

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "side"];

const MEAL_COLORS: Record<string, string> = {
  breakfast: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  lunch:     "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  dinner:    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  side:      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

function getMealColor(type: string): string {
  return MEAL_COLORS[type.toLowerCase()] || MEAL_COLORS.side;
}

function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default async function MealiePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const mealieConfig = await getMealieConfig(householdId);

  // If Mealie isn't configured, show setup prompt
  if (!mealieConfig) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ChefHat className="size-6" />
            Mealie Meal Plan
          </h1>
          <p className="text-muted-foreground">
            Connect your Mealie instance to sync meal plan ingredients
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <ChefHat className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">Mealie Not Connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure your Mealie API connection in Settings to start syncing
              your meal plan ingredients into shopping lists.
            </p>
            <Link href="/settings">
              <Button className="gap-2">
                <Settings className="size-4" />
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { month: monthParam } = await searchParams;

  // Parse month param (format: "2026-03") or use current date
  let baseDate: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    baseDate = new Date(y, m - 1, 1);
  } else {
    baseDate = new Date();
  }

  const { startDate, endDate, year, month } = getMonthRange(baseDate);

  // Navigation: prev/next month
  const prevMonth = month === 0
    ? formatMonthParam(year - 1, 11)
    : formatMonthParam(year, month - 1);
  const nextMonth = month === 11
    ? formatMonthParam(year + 1, 0)
    : formatMonthParam(year, month + 1);

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  // Fetch meal plan from Mealie
  let mealPlan: Awaited<ReturnType<typeof getMealPlan>> = [];
  let error: string | null = null;
  try {
    mealPlan = await getMealPlan(householdId, startDate, endDate);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to connect to Mealie";
  }

  // Group meals by date
  const mealsByDate = new Map<string, typeof mealPlan>();
  for (const entry of mealPlan) {
    const existing = mealsByDate.get(entry.date) || [];
    existing.push(entry);
    mealsByDate.set(entry.date, existing);
  }

  // Build calendar grid: fill in days from prev/next month to complete weeks
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDow = firstDayOfMonth.getDay(); // 0=Sun
  const daysInMonth = lastDayOfMonth.getDate();

  // Days from previous month to fill first row
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  type CalendarDay = {
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
  };

  const calendarDays: CalendarDay[] = [];

  // Previous month fill
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const dt = new Date(year, month - 1, d);
    calendarDays.push({
      dateStr: dt.toISOString().split("T")[0],
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    calendarDays.push({
      dateStr: dt.toISOString().split("T")[0],
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Next month fill to complete last row
  const remaining = 7 - (calendarDays.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      calendarDays.push({
        dateStr: dt.toISOString().split("T")[0],
        dayNum: d,
        isCurrentMonth: false,
      });
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const defaultListName = `Meal Plan ${MONTH_NAMES[month]} ${year}`;
  const totalRecipes = mealPlan.filter((e) => e.recipeId).length;

  return (
    <div className="space-y-5">
      {/* Header: Month navigation + sync action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/mealie?month=${prevMonth}`}>
            <Button variant="ghost" size="icon" className="size-9">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight min-w-[200px] text-center">
            {monthLabel}
          </h1>
          <Link href={`/mealie?month=${nextMonth}`}>
            <Button variant="ghost" size="icon" className="size-9">
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/mealie">
            <Button variant="outline" size="sm" className="ml-1 text-xs">
              Today
            </Button>
          </Link>
        </div>

        {totalRecipes > 0 && (
          <Link
            href={`/mealie/sync-review?startDate=${startDate}&endDate=${endDate}&listName=${encodeURIComponent(defaultListName)}`}
          >
            <Button size="sm" className="gap-1.5 h-9">
              <ShoppingCart className="size-3.5" />
              Sync {totalRecipes} meals
            </Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Calendar */}
      <div className="rounded-xl border overflow-hidden bg-card shadow-sm">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {DAY_HEADERS.map((day, i) => (
            <div
              key={day}
              className={`py-2.5 text-xs font-semibold text-center uppercase tracking-wider text-muted-foreground ${
                i < 6 ? "border-r border-border/50" : ""
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar rows */}
        <div className="grid grid-cols-7">
          {calendarDays.map((calDay, idx) => {
            const meals = mealsByDate.get(calDay.dateStr) || [];
            const isToday = calDay.dateStr === today;
            const hasMeals = meals.length > 0;
            const isRightEdge = (idx + 1) % 7 !== 0;
            const isNotLastRow = idx < calendarDays.length - 7;

            return (
              <div
                key={calDay.dateStr}
                className={[
                  "min-h-[130px] p-2 flex flex-col transition-colors relative",
                  isRightEdge ? "border-r border-border/50" : "",
                  isNotLastRow ? "border-b border-border/50" : "",
                  !calDay.isCurrentMonth ? "bg-muted/20" : "",
                  isToday ? "bg-primary/5 dark:bg-primary/10" : "",
                ].filter(Boolean).join(" ")}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={[
                      "text-sm font-medium leading-none",
                      isToday
                        ? "bg-primary text-primary-foreground rounded-full size-7 flex items-center justify-center font-bold"
                        : "",
                      !calDay.isCurrentMonth ? "text-muted-foreground/40" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {calDay.dayNum}
                  </span>
                </div>

                {/* Meals */}
                <div className="flex-1 space-y-1">
                  {meals
                    .sort((a, b) =>
                      MEAL_ORDER.indexOf(a.entryType) - MEAL_ORDER.indexOf(b.entryType)
                    )
                    .map((meal) => (
                      <div
                        key={meal.id}
                        className={[
                          "group rounded-md px-2 py-1.5 transition-colors",
                          getMealColor(meal.entryType),
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-0.5">
                              {meal.entryType}
                            </div>
                            <div className="text-sm font-medium leading-snug line-clamp-2">
                              {meal.recipe?.name || meal.title || meal.text || "No recipe"}
                            </div>
                          </div>
                          {meal.recipe && (
                            <Link
                              href={`/mealie/sync-review?recipeId=${meal.recipe.id}&recipeName=${encodeURIComponent(meal.recipe.name)}`}
                              className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pt-0.5 rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                              title={`Add ${meal.recipe.name} to shopping list`}
                            >
                              <ShoppingCart className="size-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Empty day — subtle indicator for current month only */}
                {!hasMeals && calDay.isCurrentMonth && (
                  <div className="flex-1 flex items-center justify-center">
                    <Utensils className="size-4 text-muted-foreground/15" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Meal type legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {Object.entries(MEAL_COLORS).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`inline-block size-2.5 rounded-sm ${colors.split(" ")[0]}`} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Empty month state */}
      {mealPlan.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">No Meals Planned</h3>
            <p className="text-sm text-muted-foreground mb-4">
              No meals found in Mealie for this month. Add meals to your Mealie meal plan
              and they&apos;ll appear here.
            </p>
            <a
              href={mealieConfig.apiUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <ExternalLink className="size-4" />
                Open Mealie
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
