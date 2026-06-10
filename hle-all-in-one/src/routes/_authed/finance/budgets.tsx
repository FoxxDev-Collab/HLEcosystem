import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { z } from "zod"
import { Copy } from "lucide-react"
import {
  copyBudgetFromPreviousMonthFn,
  getBudgetsPageFn,
  setBudgetFn,
} from "@/server/finance/fns.budgets"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

const now = new Date()

const searchSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional().catch(undefined),
  month: z.number().int().min(1).max(12).optional().catch(undefined),
})

export const Route = createFileRoute("/_authed/finance/budgets")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    year: search.year ?? now.getFullYear(),
    month: search.month ?? now.getMonth() + 1,
  }),
  loader: ({ deps }) => getBudgetsPageFn({ data: deps }),
  component: BudgetsPage,
})

function BudgetsPage() {
  const { categories, budgetCount, totalBudgeted, totalSpent, trend } =
    Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const year = search.year ?? now.getFullYear()
  const month = search.month ?? now.getMonth() + 1
  const monthName = new Date(year, month - 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  })
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const remaining = totalBudgeted - totalSpent
  const trendMax = Math.max(
    ...trend.map((m) => Math.max(m.budgeted, m.spent)),
    1
  )

  function refresh() {
    router.invalidate()
  }

  async function onSetBudget(
    e: React.FormEvent<HTMLFormElement>,
    categoryId: string
  ) {
    e.preventDefault()
    setError(null)
    const amount = Number(new FormData(e.currentTarget).get("amount") ?? 0) || 0
    try {
      const result = await setBudgetFn({
        data: { categoryId, year, month, amount },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      refresh()
    } catch {
      setError("Could not set budget.")
    }
  }

  async function onCopyPrevious() {
    setError(null)
    try {
      await copyBudgetFromPreviousMonthFn({ data: { year, month } })
      refresh()
    } catch {
      setError("Could not copy budgets.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Budget vs actual per category
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/finance/budgets"
            search={{ year: prevYear, month: prevMonth }}
          >
            <Button variant="outline" size="sm">
              ←
            </Button>
          </Link>
          <span className="px-2 text-sm font-medium">{monthName}</span>
          <Link
            to="/finance/budgets"
            search={{ year: nextYear, month: nextMonth }}
          >
            <Button variant="outline" size="sm">
              →
            </Button>
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <span className="text-xs font-medium text-muted-foreground">
              Total Budgeted
            </span>
            <div className="mt-1 text-xl font-bold tabular-nums">
              {formatCurrency(totalBudgeted)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <span className="text-xs font-medium text-muted-foreground">
              Total Spent
            </span>
            <div className="mt-1 text-xl font-bold text-red-600 tabular-nums">
              {formatCurrency(totalSpent)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <span className="text-xs font-medium text-muted-foreground">
              Remaining
            </span>
            <div
              className={`mt-1 text-xl font-bold tabular-nums ${
                remaining >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(remaining)}
            </div>
          </CardContent>
        </Card>
      </div>

      {budgetCount === 0 && (
        <Button variant="outline" onClick={onCopyPrevious}>
          <Copy className="size-4" /> Copy from{" "}
          {new Date(prevYear, prevMonth - 1).toLocaleString("en-US", {
            month: "long",
          })}
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>6-Month Trend</CardTitle>
          <CardDescription>Budget vs actual spending</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trend.map((m) => {
              const label = new Date(m.year, m.month - 1).toLocaleString(
                "en-US",
                { month: "short" }
              )
              return (
                <div key={`${m.year}-${m.month}`} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="w-10 font-medium">{label}</span>
                    <span>
                      Spent {formatCurrency(m.spent)}
                      {m.budgeted > 0 && (
                        <> / Budget {formatCurrency(m.budgeted)}</>
                      )}
                    </span>
                  </div>
                  <div className="h-4">
                    <div
                      className="h-full rounded-sm bg-blue-200 dark:bg-blue-900"
                      style={{ width: `${(m.budgeted / trendMax) * 100}%` }}
                      title={`Budgeted: ${formatCurrency(m.budgeted)}`}
                    />
                  </div>
                  <div className="-mt-1 h-4">
                    <div
                      className={`h-full rounded-sm ${
                        m.budgeted > 0 && m.spent > m.budgeted
                          ? "bg-red-400"
                          : "bg-green-400"
                      }`}
                      style={{ width: `${(m.spent / trendMax) * 100}%` }}
                      title={`Spent: ${formatCurrency(m.spent)}`}
                    />
                  </div>
                </div>
              )
            })}
            <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-blue-200 dark:bg-blue-900" />{" "}
                Budgeted
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-green-400" /> Spent
                (under)
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-red-400" /> Spent (over)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget by Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No expense categories yet. Create categories first to set budgets.
            </p>
          ) : (
            categories.map((cat) => {
              const budgeted = cat.budgeted ?? 0
              const spent = cat.spent
              const percent =
                budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0
              const overBudget = budgeted > 0 && spent > budgeted

              return (
                <div key={cat.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: cat.color ?? "#6366f1" }}
                      />
                      <span className="text-sm font-medium">
                        {cat.parentCategoryId ? `— ${cat.name}` : cat.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span
                        className={
                          overBudget
                            ? "font-medium text-red-600"
                            : "text-muted-foreground"
                        }
                      >
                        {formatCurrency(spent)}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <form
                        onSubmit={(e) => onSetBudget(e, cat.id)}
                        className="flex items-center gap-1"
                      >
                        <Input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={budgeted || ""}
                          placeholder="0"
                          className="h-7 w-24 text-right text-sm"
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                        >
                          Set
                        </Button>
                      </form>
                    </div>
                  </div>
                  {budgeted > 0 && <Progress value={percent} />}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
