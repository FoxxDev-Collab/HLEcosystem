import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Building2,
  Clock,
  CreditCard,
  FileText,
  PiggyBank,
  Repeat,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { getFinanceDashboardFn } from "@/server/finance/fns.dashboard"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const Route = createFileRoute("/_authed/finance/dashboard")({
  loader: () => getFinanceDashboardFn(),
  component: FinanceDashboardPage,
})

function TrendIndicator({
  current,
  previous,
  inverted = false,
}: {
  current: number
  previous: number
  inverted?: boolean
}) {
  if (previous === 0) return null
  const pctChange = ((current - previous) / previous) * 100
  const isPositive = inverted ? pctChange < 0 : pctChange > 0
  return (
    <span
      className={`text-[10px] font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
    >
      {pctChange > 0 ? "+" : ""}
      {pctChange.toFixed(0)}% vs last month
    </span>
  )
}

function amountClass(type: string): string {
  if (type === "INCOME") return "text-green-600"
  if (type === "EXPENSE") return "text-red-600"
  return "text-muted-foreground"
}

function amountSign(type: string): string {
  if (type === "INCOME") return "+"
  if (type === "EXPENSE") return "-"
  return ""
}

function FinanceDashboardPage() {
  const {
    accounts,
    flows,
    recentTransactions,
    upcomingBills,
    netWorthTotals,
    spendingByCategory,
  } = Route.useLoaderData()

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0)
  const monthlySavings = flows.monthIncome - flows.monthExpenses
  const netWorth =
    totalBalance +
    netWorthTotals.totalAssetValue -
    netWorthTotals.totalDebtAmount
  const monthName = new Date().toLocaleString("en-US", { month: "long" })
  const today = new Date().getDate()

  const savingsRate =
    flows.monthIncome > 0
      ? Math.round((monthlySavings / flows.monthIncome) * 100)
      : 0
  const circumference = 2 * Math.PI * 36
  const ringOffset =
    circumference -
    (Math.max(0, Math.min(savingsRate, 100)) / 100) * circumference

  const totalSpendingForRing = flows.monthExpenses || 1

  return (
    <div className="max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Finance Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="px-4 pt-4 pb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Total Balance
              </span>
              <Wallet className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">
              {formatCurrency(totalBalance)}
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4 pt-4 pb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {monthName} Income
              </span>
              <TrendingUp className="size-3.5 text-green-600" />
            </div>
            <div className="text-xl font-bold text-green-600 tabular-nums">
              {formatCurrency(flows.monthIncome)}
            </div>
            <TrendIndicator
              current={flows.monthIncome}
              previous={flows.prevIncome}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4 pt-4 pb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {monthName} Expenses
              </span>
              <TrendingDown className="size-3.5 text-red-600" />
            </div>
            <div className="text-xl font-bold text-red-600 tabular-nums">
              {formatCurrency(flows.monthExpenses)}
            </div>
            <TrendIndicator
              current={flows.monthExpenses}
              previous={flows.prevExpenses}
              inverted
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4 pt-4 pb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Net Savings
              </span>
              <PiggyBank className="size-3.5 text-muted-foreground/50" />
            </div>
            <div
              className={`text-xl font-bold tabular-nums ${monthlySavings >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(monthlySavings)}
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {savingsRate}% savings rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Accounts</h2>
              </div>
              <Link
                to="/finance/accounts"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            {accounts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No accounts yet. Add your first account to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {accounts.slice(0, 6).map((account) => (
                  <Link
                    key={account.id}
                    to="/finance/accounts/$id"
                    params={{ id: account.id }}
                  >
                    <div className="rounded-lg border p-3 transition-colors hover:bg-accent/30">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: account.color ?? "#6366f1",
                            }}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {account.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {account.institution ?? account.type}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`shrink-0 text-sm font-bold tabular-nums ${account.currentBalance < 0 ? "text-red-600" : ""}`}
                        >
                          {formatCurrency(account.currentBalance)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Recent Transactions</h2>
              </div>
              <Link
                to="/finance/transactions"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {recentTransactions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No transactions yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-accent/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {tx.payee ?? tx.description ?? "Transaction"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {tx.categoryName ?? "Uncategorized"} ·{" "}
                            {tx.accountName} · {formatDate(tx.date)}
                          </p>
                        </div>
                        <span
                          className={`ml-3 shrink-0 text-sm font-semibold tabular-nums ${amountClass(tx.type)}`}
                        >
                          {amountSign(tx.type)}
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <PiggyBank className="size-4" />
                Savings Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-center">
                <svg
                  width="88"
                  height="88"
                  viewBox="0 0 88 88"
                  className="-rotate-90"
                >
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-muted/50"
                  />
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className={
                      savingsRate >= 0 ? "text-primary" : "text-destructive"
                    }
                    strokeDasharray={circumference}
                    strokeDashoffset={ringOffset}
                  />
                  <text
                    x="44"
                    y="44"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-foreground text-sm font-bold"
                    style={{
                      transform: "rotate(90deg)",
                      transformOrigin: "center",
                    }}
                  >
                    {savingsRate}%
                  </text>
                </svg>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {savingsRate >= 20
                  ? "Great savings rate!"
                  : savingsRate >= 10
                    ? "On track"
                    : "Room to improve"}
              </p>
            </CardContent>
          </Card>

          {spendingByCategory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="size-4" />
                  Top Spending
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {spendingByCategory.map((cat) => {
                  const percent = Math.round(
                    (cat.amount / totalSpendingForRing) * 100
                  )
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: cat.color ?? "#6b7280",
                            }}
                          />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <span className="text-muted-foreground tabular-nums">
                          {formatCurrency(cat.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: cat.color ?? "#6b7280",
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {upcomingBills.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4" />
                  Upcoming Bills
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingBills.map((bill) => {
                  const isDue = bill.dueDayOfMonth <= today && !bill.isPaid
                  return (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={`size-1.5 shrink-0 rounded-full ${
                            bill.isPaid
                              ? "bg-green-500"
                              : isDue
                                ? "bg-red-500"
                                : "bg-muted-foreground/30"
                          }`}
                        />
                        <span className="truncate text-xs">{bill.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(bill.expectedAmount)}
                        </span>
                        <Badge
                          variant={
                            bill.isPaid
                              ? "secondary"
                              : isDue
                                ? "destructive"
                                : "outline"
                          }
                          className="px-1.5 py-0 text-[9px]"
                        >
                          {bill.isPaid
                            ? "Paid"
                            : isDue
                              ? "Due"
                              : `Day ${bill.dueDayOfMonth}`}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Net Worth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <p
                className={`text-center text-lg font-bold tabular-nums ${netWorth < 0 ? "text-red-600" : ""}`}
              >
                {formatCurrency(netWorth)}
              </p>
              <Separator />
              <div className="space-y-1.5">
                <Link
                  to="/finance/accounts"
                  className="flex items-center justify-between py-0.5 text-xs transition-colors hover:text-primary"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="size-3 text-muted-foreground" />
                    <span>Cash &amp; Bank</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {formatCurrency(totalBalance)}
                  </span>
                </Link>
                {netWorthTotals.assetCount > 0 && (
                  <Link
                    to="/finance/assets"
                    className="flex items-center justify-between py-0.5 text-xs transition-colors hover:text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3 text-muted-foreground" />
                      <span>Assets</span>
                    </div>
                    <span className="text-green-600 tabular-nums">
                      {formatCurrency(netWorthTotals.totalAssetValue)}
                    </span>
                  </Link>
                )}
                {netWorthTotals.debtCount > 0 && (
                  <Link
                    to="/finance/debts"
                    className="flex items-center justify-between py-0.5 text-xs transition-colors hover:text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-3 text-muted-foreground" />
                      <span>Debts</span>
                    </div>
                    <span className="text-red-600 tabular-nums">
                      -{formatCurrency(netWorthTotals.totalDebtAmount)}
                    </span>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link
                to="/finance/transactions"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <ArrowLeftRight className="size-3.5" />
                Add transaction
              </Link>
              <Link
                to="/finance/recurring"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <Repeat className="size-3.5" />
                Recurring transactions
              </Link>
              <Link
                to="/finance/budgets"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <BarChart3 className="size-3.5" />
                Review budget
              </Link>
              <Link
                to="/finance/categories"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <Tag className="size-3.5" />
                Manage categories
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
