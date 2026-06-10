import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { Download } from "lucide-react"
import {
  exportTransactionsCsvFn,
  getReportDataFn,
} from "@/server/finance/fns.reports"
import { formatCurrency, formatPercent } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const searchSchema = z.object({
  year: z.number().int().min(1970).max(2100).optional().catch(undefined),
  month: z.number().int().min(1).max(12).optional().catch(undefined),
})

export const Route = createFileRoute("/_authed/finance/reports")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    year: search.year ?? new Date().getFullYear(),
    month: search.month ?? null,
  }),
  loader: ({ deps }) => getReportDataFn({ data: deps }),
  component: ReportsPage,
})

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString("en-US", { month: "short" })
)

function ReportsPage() {
  const data = Route.useLoaderData()
  const { year: searchYear, month } = Route.useSearch()
  const year = searchYear ?? new Date().getFullYear()

  const periodLabel = month
    ? new Date(year, month - 1).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      })
    : String(year)

  const maxTrendValue = Math.max(
    ...data.monthlyTrends.map((t) => Math.max(t.income, t.expenses)),
    1
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {[year - 1, year, year + 1].map((y) => (
            <Button
              key={y}
              variant={y === year && !month ? "default" : "outline"}
              size="sm"
              render={<Link to="/finance/reports" search={{ year: y }} />}
            >
              {y}
            </Button>
          ))}
          <ExportButton year={year} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          variant={!month ? "default" : "ghost"}
          size="sm"
          render={<Link to="/finance/reports" search={{ year }} />}
        >
          Full Year
        </Button>
        {MONTH_NAMES.map((label, i) => (
          <Button
            key={label}
            variant={month === i + 1 ? "default" : "ghost"}
            size="sm"
            render={
              <Link to="/finance/reports" search={{ year, month: i + 1 }} />
            }
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Total Income"
          value={formatCurrency(data.totalIncome)}
          valueClass="text-green-600"
          hint={`Avg ${formatCurrency(data.averageMonthlyIncome)}/mo`}
        />
        <SummaryCard
          label="Total Expenses"
          value={formatCurrency(data.totalExpenses)}
          valueClass="text-red-600"
          hint={`Avg ${formatCurrency(data.averageMonthlyExpense)}/mo`}
        />
        <SummaryCard
          label="Net Savings"
          value={formatCurrency(data.netSavings)}
          valueClass={data.netSavings >= 0 ? "text-green-600" : "text-red-600"}
        />
        <SummaryCard
          label="Savings Rate"
          value={formatPercent(data.savingsRate)}
          valueClass={data.savingsRate >= 0 ? "text-green-600" : "text-red-600"}
          hint="of income saved"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Cash Flow</CardTitle>
          <CardDescription>
            Income vs expenses over the last 12 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.monthlyTrends.map((m) => (
              <div key={`${m.year}-${m.month}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="w-16 font-medium">{m.label}</span>
                  <div className="flex gap-4 text-muted-foreground">
                    <span className="text-green-600">
                      {formatCurrency(m.income)}
                    </span>
                    <span className="text-red-600">
                      {formatCurrency(m.expenses)}
                    </span>
                    <span
                      className={`font-medium ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {m.net >= 0 ? "+" : ""}
                      {formatCurrency(m.net)}
                    </span>
                  </div>
                </div>
                <div
                  className="h-2 rounded-full bg-green-500 transition-all"
                  style={{ width: `${(m.income / maxTrendValue) * 100}%` }}
                />
                <div
                  className="h-2 rounded-full bg-red-400 transition-all"
                  style={{ width: `${(m.expenses / maxTrendValue) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-full bg-green-500" />{" "}
              Income
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-full bg-red-400" />{" "}
              Expenses
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
          <CardDescription>Where your money goes</CardDescription>
        </CardHeader>
        <CardContent>
          {data.spendingByCategory.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No expense data for this period
            </p>
          ) : (
            <div className="space-y-3">
              {data.spendingByCategory.map((cat) => (
                <div key={cat.categoryId ?? "none"} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: cat.categoryColor }}
                      />
                      <span className="font-medium">{cat.categoryName}</span>
                      <span className="text-muted-foreground">
                        ({cat.count})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {formatPercent(cat.percentage)}
                      </span>
                      <span className="w-24 text-right font-medium tabular-nums">
                        {formatCurrency(cat.total)}
                      </span>
                    </div>
                  </div>
                  <Progress value={cat.percentage} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Flows</CardTitle>
          <CardDescription>Income and spending per account</CardDescription>
        </CardHeader>
        <CardContent>
          {data.accountFlows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No account activity for this period
            </p>
          ) : (
            <div className="divide-y">
              {data.accountFlows.map((flow) => (
                <div
                  key={flow.accountId}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {flow.accountName}
                  </span>
                  <span className="w-28 text-right text-green-600 tabular-nums">
                    {formatCurrency(flow.income)}
                  </span>
                  <span className="w-28 text-right text-red-600 tabular-nums">
                    {formatCurrency(flow.expenses)}
                  </span>
                  <span
                    className={`w-28 text-right font-medium tabular-nums ${flow.net >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {flow.net >= 0 ? "+" : ""}
                    {formatCurrency(flow.net)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data.topExpenseCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                Your biggest expense category is{" "}
                <strong>{data.topExpenseCategories[0].categoryName}</strong> at{" "}
                <strong>
                  {formatCurrency(data.topExpenseCategories[0].total)}
                </strong>{" "}
                ({formatPercent(data.topExpenseCategories[0].percentage)} of
                spending).
              </p>
              {data.savingsRate > 0 ? (
                <p className="text-green-700">
                  You&apos;re saving {formatPercent(data.savingsRate)} of your
                  income. Keep it up!
                </p>
              ) : data.savingsRate < 0 ? (
                <p className="text-red-700">
                  You&apos;re spending more than you earn. Consider reviewing
                  your {data.topExpenseCategories[0].categoryName} spending.
                </p>
              ) : null}
              <MonthOverMonth trends={data.monthlyTrends} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string
  value: string
  valueClass: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="px-4 pt-4 pb-3">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <div className={`mt-1 text-xl font-bold tabular-nums ${valueClass}`}>
          {value}
        </div>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function MonthOverMonth({ trends }: { trends: Array<{ expenses: number }> }) {
  if (trends.length < 2) return null
  const recent = trends[trends.length - 1]
  const prev = trends[trends.length - 2]
  if (prev.expenses === 0) return null
  const change = ((recent.expenses - prev.expenses) / prev.expenses) * 100
  if (Math.abs(change) < 1) return <p>Spending is stable month-over-month.</p>
  return (
    <p>
      {change > 0
        ? `Spending increased ${formatPercent(change)} from last month.`
        : `Spending decreased ${formatPercent(Math.abs(change))} from last month.`}
    </p>
  )
}

// Legacy export-button.tsx: server fn returns the CSV string; the browser
// triggers the download from a Blob.
function ExportButton({ year }: { year: number }) {
  const [pending, setPending] = useState(false)

  async function handleExport() {
    setPending(true)
    try {
      const { csv } = await exportTransactionsCsvFn({ data: { year } })
      if (!csv) return
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `transactions-${year}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={pending}
    >
      <Download className="size-4" />
      Export CSV
    </Button>
  )
}
