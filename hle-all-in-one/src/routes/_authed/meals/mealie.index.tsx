import { useEffect, useRef } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { z } from "zod"
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChefHat,
  ExternalLink,
  Settings,
  ShoppingCart,
  Utensils,
} from "lucide-react"
import { getMealPlanPageFn } from "@/server/meals/fns.mealie"
import { syncMealieFn } from "@/server/meals/fns.settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const searchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute("/_authed/meals/mealie/")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ deps }) => getMealPlanPageFn({ data: { month: deps.month } }),
  component: MealiePlanPage,
})

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "side"]
const MEAL_COLORS: Record<string, string> = {
  breakfast:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  lunch: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  dinner:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  side: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
}

function mealColor(type: string): string {
  return MEAL_COLORS[type.toLowerCase()] || MEAL_COLORS.side
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Fires a background sync once on mount; the server skips when the cache is
// fresh (<30 min), so repeated navigations are free.
function useBackgroundMealieSync(enabled: boolean) {
  const router = useRouter()
  const fired = useRef(false)
  useEffect(() => {
    if (!enabled || fired.current) return
    fired.current = true
    syncMealieFn()
      .then((result) => {
        if (result && "synced" in result) router.invalidate()
      })
      .catch(() => {})
  }, [enabled, router])
}

function MealiePlanPage() {
  const { configured, apiUrl, entries, calories, error } = Route.useLoaderData()
  const { month } = Route.useSearch()
  useBackgroundMealieSync(configured)

  if (!configured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ChefHat className="size-5" />
            Mealie Meal Plan
          </h1>
          <p className="text-sm text-muted-foreground">
            Connect your Mealie instance to sync meal plan ingredients
          </p>
        </div>
        <NotConnectedCard
          icon={
            <ChefHat className="mx-auto mb-4 size-12 text-muted-foreground" />
          }
          text="Configure your Mealie API connection in Settings to start syncing your meal plan ingredients into shopping lists."
        />
      </div>
    )
  }

  // Parse the month param (format "2026-06") or use the current date.
  const baseDate = month
    ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
    : new Date()
  const year = baseDate.getFullYear()
  const monthIdx = baseDate.getMonth()

  const prevMonth =
    monthIdx === 0 ? monthParam(year - 1, 11) : monthParam(year, monthIdx - 1)
  const nextMonth =
    monthIdx === 11 ? monthParam(year + 1, 0) : monthParam(year, monthIdx + 1)

  const startDate = localDateStr(new Date(year, monthIdx, 1))
  const endDate = localDateStr(new Date(year, monthIdx + 1, 0))

  const mealsByDate = new Map<string, typeof entries>()
  for (const entry of entries) {
    const existing = mealsByDate.get(entry.date) ?? []
    existing.push(entry)
    mealsByDate.set(entry.date, existing)
  }

  function dayCalories(dateStr: string): number | null {
    const meals = mealsByDate.get(dateStr)
    if (!meals) return null
    let total = 0
    let hasAny = false
    for (const meal of meals) {
      if (!meal.recipeId) continue
      const cal = calories[meal.recipeId]
      if (cal !== undefined) {
        total += cal
        hasAny = true
      }
    }
    return hasAny ? total : null
  }

  // Build the calendar grid, padding with prev/next-month days.
  const startDow = new Date(year, monthIdx, 1).getDay()
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const prevMonthLastDay = new Date(year, monthIdx, 0).getDate()

  const calendarDays: Array<{
    dateStr: string
    dayNum: number
    isCurrentMonth: boolean
  }> = []
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    calendarDays.push({
      dateStr: localDateStr(new Date(year, monthIdx - 1, d)),
      dayNum: d,
      isCurrentMonth: false,
    })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      dateStr: localDateStr(new Date(year, monthIdx, d)),
      dayNum: d,
      isCurrentMonth: true,
    })
  }
  const remaining = 7 - (calendarDays.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      calendarDays.push({
        dateStr: localDateStr(new Date(year, monthIdx + 1, d)),
        dayNum: d,
        isCurrentMonth: false,
      })
    }
  }

  const today = localDateStr(new Date())
  const totalRecipes = entries.filter((e) => e.recipeId).length
  const defaultListName = `Meal Plan ${MONTH_NAMES[monthIdx]} ${year}`

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/meals/mealie" search={{ month: prevMonth }}>
            <Button variant="ghost" size="icon" className="size-9">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="min-w-[200px] text-center text-xl font-semibold">
            {MONTH_NAMES[monthIdx]} {year}
          </h1>
          <Link to="/meals/mealie" search={{ month: nextMonth }}>
            <Button variant="ghost" size="icon" className="size-9">
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link to="/meals/mealie" search={{}}>
            <Button variant="outline" size="sm" className="ml-1 text-xs">
              Today
            </Button>
          </Link>
        </div>

        {totalRecipes > 0 && (
          <Link
            to="/meals/mealie/sync-review"
            search={{ startDate, endDate, listName: defaultListName }}
          >
            <Button size="sm" className="h-9">
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

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {DAY_HEADERS.map((day, i) => (
            <div
              key={day}
              className={`py-2.5 text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase ${
                i < 6 ? "border-r border-border/50" : ""
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((calDay, idx) => {
            const meals = mealsByDate.get(calDay.dateStr) ?? []
            const isToday = calDay.dateStr === today
            const cal = dayCalories(calDay.dateStr)
            return (
              <div
                key={calDay.dateStr}
                className={[
                  "relative flex min-h-[130px] flex-col p-2",
                  (idx + 1) % 7 !== 0 ? "border-r border-border/50" : "",
                  idx < calendarDays.length - 7
                    ? "border-b border-border/50"
                    : "",
                  !calDay.isCurrentMonth ? "bg-muted/20" : "",
                  isToday ? "bg-primary/5 dark:bg-primary/10" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={[
                      "text-sm leading-none font-medium",
                      isToday
                        ? "flex size-7 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
                        : "",
                      !calDay.isCurrentMonth ? "text-muted-foreground/40" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {calDay.dayNum}
                  </span>
                </div>

                <div className="flex-1 space-y-1">
                  {[...meals]
                    .sort(
                      (a, b) =>
                        MEAL_ORDER.indexOf(a.entryType) -
                        MEAL_ORDER.indexOf(b.entryType)
                    )
                    .map((meal) => (
                      <div
                        key={meal.id}
                        className={`group rounded-md px-2 py-1.5 ${mealColor(meal.entryType)}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 text-[10px] leading-none font-semibold tracking-wide uppercase opacity-70">
                              {meal.entryType}
                            </div>
                            <div className="line-clamp-2 text-sm leading-snug font-medium">
                              {meal.recipe?.name ||
                                meal.title ||
                                meal.text ||
                                "No recipe"}
                            </div>
                          </div>
                          {meal.recipe && (
                            <Link
                              to="/meals/mealie/sync-review"
                              search={{
                                recipeId: meal.recipe.id,
                                recipeName: meal.recipe.name,
                              }}
                              className="shrink-0 rounded p-1 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                              title={`Add ${meal.recipe.name} to shopping list`}
                            >
                              <ShoppingCart className="size-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {cal !== null && (
                  <div className="mt-auto pt-1 text-[10px] font-medium text-muted-foreground">
                    ~{cal} cal
                  </div>
                )}

                {meals.length === 0 && calDay.isCurrentMonth && (
                  <div className="flex flex-1 items-center justify-center">
                    <Utensils className="size-4 text-muted-foreground/15" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {Object.entries(MEAL_COLORS).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-2.5 rounded-sm ${colors.split(" ")[0]}`}
            />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>

      {entries.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold">No Meals Planned</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              No meals found in Mealie for this month. Add meals to your Mealie
              meal plan and they&apos;ll appear here.
            </p>
            {apiUrl && (
              <a href={apiUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <ExternalLink className="size-4" />
                  Open Mealie
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function NotConnectedCard({
  icon,
  text,
}: {
  icon: React.ReactNode
  text: string
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        {icon}
        <h3 className="mb-1 text-lg font-semibold">Mealie Not Connected</h3>
        <p className="mb-4 text-sm text-muted-foreground">{text}</p>
        <Link to="/meals/settings">
          <Button>
            <Settings className="size-4" />
            Go to Settings
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
