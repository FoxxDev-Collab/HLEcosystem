import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getReportData } from "./actions";
import { ExportButton } from "./export-button";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const now = new Date();
  const year = parseInt(params.year || String(now.getFullYear()));
  const month = params.month ? parseInt(params.month) : undefined;

  const data = await getReportData(year, month);
  if (!data) redirect("/login");

  const periodLabel = month
    ? new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" })
    : String(year);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Year selector */}
          {[year - 1, year, year + 1].map((y) => (
            <a key={y} href={`/reports?year=${y}`}>
              <Button variant={y === year && !month ? "default" : "outline"} size="sm">{y}</Button>
            </a>
          ))}
          <ExportButton year={year} />
        </div>
      </div>

      {/* Month filter */}
      <div className="flex flex-wrap gap-1">
        <a href={`/reports?year=${year}`}>
          <Button variant={!month ? "default" : "ghost"} size="sm">Full Year</Button>
        </a>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <a key={m} href={`/reports?year=${year}&month=${m}`}>
            <Button variant={month === m ? "default" : "ghost"} size="sm">
              {new Date(year, m - 1).toLocaleString("en-US", { month: "short" })}
            </Button>
          </a>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Income</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(data.totalIncome)}</div>
            <p className="text-xs text-muted-foreground">Avg {formatCurrency(data.averageMonthlyIncome)}/mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Expenses</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">Avg {formatCurrency(data.averageMonthlyExpense)}/mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Savings</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.netSavings >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(data.netSavings)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Savings Rate</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.savingsRate >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatPercent(data.savingsRate)}
            </div>
            <p className="text-xs text-muted-foreground">of income saved</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend - ASCII bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Cash Flow</CardTitle>
          <CardDescription>Income vs expenses over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.monthlyTrends.map((m) => {
              const maxVal = Math.max(
                ...data.monthlyTrends.map((t) => Math.max(t.income, t.expenses)),
                1
              );
              const incomeWidth = (m.income / maxVal) * 100;
              const expenseWidth = (m.expenses / maxVal) * 100;

              return (
                <div key={`${m.year}-${m.month}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium w-16">{m.label}</span>
                    <div className="flex gap-4 text-muted-foreground">
                      <span className="text-green-600">{formatCurrency(m.income)}</span>
                      <span className="text-red-600">{formatCurrency(m.expenses)}</span>
                      <span className={`font-medium ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {m.net >= 0 ? "+" : ""}{formatCurrency(m.net)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${incomeWidth}%` }} />
                  </div>
                  <div className="flex gap-1">
                    <div className="h-2 rounded-full bg-red-400 transition-all" style={{ width: `${expenseWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground mt-4 pt-3 border-t">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full bg-green-500 inline-block" /> Income</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full bg-red-400 inline-block" /> Expenses</span>
          </div>
        </CardContent>
      </Card>

      {/* Spending by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
          <CardDescription>Where your money goes</CardDescription>
        </CardHeader>
        <CardContent>
          {data.spendingByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No expense data for this period</p>
          ) : (
            <div className="space-y-3">
              {data.spendingByCategory.map((cat) => (
                <div key={cat.categoryId || "none"} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.categoryColor }} />
                      <span className="font-medium">{cat.categoryName}</span>
                      <span className="text-muted-foreground">({cat.count})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{formatPercent(cat.percentage)}</span>
                      <span className="font-medium w-24 text-right">{formatCurrency(cat.total)}</span>
                    </div>
                  </div>
                  <Progress
                    value={cat.percentage}
                    className="h-2"
                    style={{ ["--progress-color" as string]: cat.categoryColor } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Insights */}
      {data.topExpenseCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                Your biggest expense category is <strong>{data.topExpenseCategories[0].categoryName}</strong> at{" "}
                <strong>{formatCurrency(data.topExpenseCategories[0].total)}</strong>{" "}
                ({formatPercent(data.topExpenseCategories[0].percentage)} of spending).
              </p>
              {data.savingsRate > 0 ? (
                <p className="text-green-700">
                  You&apos;re saving {formatPercent(data.savingsRate)} of your income. Keep it up!
                </p>
              ) : data.savingsRate < 0 ? (
                <p className="text-red-700">
                  You&apos;re spending more than you earn. Consider reviewing your {data.topExpenseCategories[0].categoryName} spending.
                </p>
              ) : null}
              {data.monthlyTrends.length >= 2 && (
                <p>
                  {(() => {
                    const recent = data.monthlyTrends[data.monthlyTrends.length - 1];
                    const prev = data.monthlyTrends[data.monthlyTrends.length - 2];
                    if (prev.expenses === 0) return null;
                    const change = ((recent.expenses - prev.expenses) / prev.expenses) * 100;
                    if (Math.abs(change) < 1) return "Spending is stable month-over-month.";
                    return change > 0
                      ? `Spending increased ${formatPercent(change)} from last month.`
                      : `Spending decreased ${formatPercent(Math.abs(change))} from last month.`;
                  })()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
