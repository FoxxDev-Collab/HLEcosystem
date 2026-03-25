import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowRight,
  CreditCard,
  FileText,
  Building2,
  ArrowLeftRight,
  BarChart3,
  Clock,
} from "lucide-react";

async function getDashboardData(householdId: string) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Previous month for comparison
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    accounts,
    monthlyTransactions,
    prevMonthTransactions,
    recentTransactions,
    upcomingBills,
    totalDebts,
    totalAssets,
    topCategories,
  ] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: firstOfMonth, lte: lastOfMonth },
      },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: firstOfPrevMonth, lte: lastOfPrevMonth },
      },
    }),
    prisma.transaction.findMany({
      where: { householdId },
      include: { category: true, account: true },
      orderBy: { date: "desc" },
      take: 8,
    }),
    prisma.monthlyBill.findMany({
      where: { householdId, isActive: true },
      include: {
        payments: {
          where: {
            dueDate: { gte: firstOfMonth, lte: lastOfMonth },
          },
        },
      },
      orderBy: { dueDayOfMonth: "asc" },
      take: 5,
    }),
    prisma.debt.aggregate({
      where: { householdId, isArchived: false },
      _sum: { currentBalance: true },
      _count: { _all: true },
    }),
    prisma.asset.aggregate({
      where: { householdId },
      _sum: { currentValue: true },
      _count: { _all: true },
    }),
    // Top spending categories this month
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        householdId,
        type: "EXPENSE",
        isBalanceAdjustment: false,
        date: { gte: firstOfMonth, lte: lastOfMonth },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
  ]);

  // Fetch category names for top spending
  const categoryIds = topCategories
    .map((tc) => tc.categoryId)
    .filter((id): id is string => id !== null);
  const categories = categoryIds.length > 0
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, color: true },
      })
    : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const monthlyIncome = monthlyTransactions
    .filter((t) => t.type === "INCOME" && !t.isBalanceAdjustment)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlyExpenses = monthlyTransactions
    .filter((t) => t.type === "EXPENSE" && !t.isBalanceAdjustment)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlySavings = monthlyIncome - monthlyExpenses;

  // Previous month comparison
  const prevIncome = prevMonthTransactions
    .filter((t) => t.type === "INCOME" && !t.isBalanceAdjustment)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const prevExpenses = prevMonthTransactions
    .filter((t) => t.type === "EXPENSE" && !t.isBalanceAdjustment)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalDebtAmount = Number(totalDebts._sum?.currentBalance ?? 0);
  const totalAssetValue = Number(totalAssets._sum?.currentValue ?? 0);
  const netWorth = totalBalance + totalAssetValue - totalDebtAmount;

  // Spending breakdown for ring chart
  const totalSpendingForRing = monthlyExpenses || 1;
  const spendingByCategory = topCategories.map((tc) => {
    const cat = tc.categoryId ? categoryMap.get(tc.categoryId) : null;
    return {
      name: cat?.name ?? "Other",
      color: cat?.color ?? "#6b7280",
      amount: Number(tc._sum.amount ?? 0),
      percent: Math.round((Number(tc._sum.amount ?? 0) / totalSpendingForRing) * 100),
    };
  });

  return {
    accounts,
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    prevIncome,
    prevExpenses,
    recentTransactions,
    upcomingBills,
    totalDebtAmount,
    totalAssetValue,
    netWorth,
    debtCount: totalDebts._count._all,
    assetCount: totalAssets._count._all,
    spendingByCategory,
  };
}

function TrendIndicator({ current, previous, inverted = false }: { current: number; previous: number; inverted?: boolean }) {
  if (previous === 0) return null;
  const pctChange = ((current - previous) / previous) * 100;
  const isPositive = inverted ? pctChange < 0 : pctChange > 0;

  return (
    <span className={`text-[10px] font-medium ${isPositive ? "tx-income" : "tx-expense"}`}>
      {pctChange > 0 ? "+" : ""}{pctChange.toFixed(0)}% vs last month
    </span>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const data = await getDashboardData(householdId);
  const monthName = new Date().toLocaleString("en-US", { month: "long" });
  const today = new Date().getDate();

  // Spending ring SVG
  const circumference = 2 * Math.PI * 36;
  const savingsRate = data.monthlyIncome > 0
    ? Math.round((data.monthlySavings / data.monthlyIncome) * 100)
    : 0;
  const ringOffset = circumference - (Math.max(0, Math.min(savingsRate, 100)) / 100) * circumference;

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Summary cards — 4 columns */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.14 260)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Total Balance</span>
              <Wallet className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(data.totalBalance)}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {data.accounts.length} account{data.accounts.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.16 145)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">{monthName} Income</span>
              <TrendingUp className="size-3.5 tx-income" />
            </div>
            <div className="text-xl font-bold tabular-nums tx-income">{formatCurrency(data.monthlyIncome)}</div>
            <TrendIndicator current={data.monthlyIncome} previous={data.prevIncome} />
          </CardContent>
        </Card>

        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.2 25)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">{monthName} Expenses</span>
              <TrendingDown className="size-3.5 tx-expense" />
            </div>
            <div className="text-xl font-bold tabular-nums tx-expense">{formatCurrency(data.monthlyExpenses)}</div>
            <TrendIndicator current={data.monthlyExpenses} previous={data.prevExpenses} inverted />
          </CardContent>
        </Card>

        <Card className="stat-card-accent" style={{ "--stat-color": data.monthlySavings >= 0 ? "oklch(0.55 0.16 145)" : "oklch(0.55 0.2 25)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Net Savings</span>
              <PiggyBank className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className={`text-xl font-bold tabular-nums ${data.monthlySavings >= 0 ? "tx-income" : "tx-expense"}`}>
              {formatCurrency(data.monthlySavings)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {savingsRate}% savings rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Left column — main content */}
        <div className="space-y-6 min-w-0">
          {/* Accounts */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Accounts</h2>
              </div>
              <Link
                href="/accounts"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            {data.accounts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No accounts yet. Add your first account to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.accounts.slice(0, 6).map((account) => (
                  <Link key={account.id} href={`/accounts/${account.id}`}>
                    <div
                      className="account-card rounded-lg border p-3"
                      style={{ "--account-color": account.color || "#6366f1" } as React.CSSProperties}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 pl-1">
                          <p className="text-sm font-medium truncate">{account.name}</p>
                          <p className="text-[10px] text-muted-foreground">{account.institution || account.type}</p>
                        </div>
                        <p className={`text-sm font-bold tabular-nums shrink-0 ${Number(account.currentBalance) < 0 ? "tx-expense" : ""}`}>
                          {formatCurrency(account.currentBalance)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recent transactions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Recent Transactions</h2>
              </div>
              <Link
                href="/transactions"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {data.recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No transactions yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {data.recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {tx.payee || tx.description || "Transaction"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {tx.category?.name || "Uncategorized"} &middot; {tx.account.name} &middot; {formatDate(tx.date)}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-semibold tabular-nums shrink-0 ml-3 ${
                            tx.type === "INCOME" ? "tx-income" : tx.type === "EXPENSE" ? "tx-expense" : "tx-transfer"
                          }`}
                        >
                          {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
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

        {/* Right column — sidebar */}
        <div className="space-y-6">
          {/* Savings rate ring */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PiggyBank className="size-4" />
                Savings Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-center">
                <svg className="spending-ring" width="88" height="88" viewBox="0 0 88 88">
                  <circle
                    cx="44" cy="44" r="36"
                    fill="none" stroke="currentColor" strokeWidth="6"
                    className="text-muted/50"
                  />
                  <circle
                    cx="44" cy="44" r="36"
                    fill="none" stroke="currentColor" strokeWidth="6"
                    strokeLinecap="round"
                    className={savingsRate >= 0 ? "text-primary" : "text-destructive"}
                    strokeDasharray={circumference}
                    strokeDashoffset={ringOffset}
                  />
                  <text
                    x="44" y="44"
                    textAnchor="middle" dominantBaseline="central"
                    className="fill-foreground text-sm font-bold"
                    style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
                  >
                    {savingsRate}%
                  </text>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {savingsRate >= 20 ? "Great savings rate!" : savingsRate >= 10 ? "On track" : "Room to improve"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Top spending categories */}
          {data.spendingByCategory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="size-4" />
                  Top Spending
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data.spendingByCategory.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <span className="text-muted-foreground tabular-nums">{formatCurrency(cat.amount)}</span>
                    </div>
                    <div className="budget-bar">
                      <div
                        className="budget-bar-fill"
                        style={{
                          width: `${cat.percent}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <Link
                  href="/reports"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  Full report
                  <ArrowRight className="size-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Upcoming bills */}
          {data.upcomingBills.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4" />
                  Upcoming Bills
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.upcomingBills.map((bill) => {
                  const isPaid = bill.payments.length > 0;
                  const isDue = bill.dueDayOfMonth <= today && !isPaid;
                  return (
                    <div key={bill.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`size-1.5 rounded-full shrink-0 ${isPaid ? "bg-green-500" : isDue ? "bg-red-500" : "bg-muted-foreground/30"}`} />
                        <span className="text-xs truncate">{bill.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(bill.expectedAmount)}
                        </span>
                        <Badge variant={isPaid ? "secondary" : isDue ? "destructive" : "outline"} className="text-[9px] px-1.5 py-0">
                          {isPaid ? "Paid" : isDue ? "Due" : `Day ${bill.dueDayOfMonth}`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                <Link
                  href="/bills"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  All bills
                  <ArrowRight className="size-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Net Worth snapshot */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Net Worth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="text-center">
                <p className={`text-lg font-bold tabular-nums ${data.netWorth >= 0 ? "" : "tx-expense"}`}>
                  {formatCurrency(data.netWorth)}
                </p>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Link
                  href="/accounts"
                  className="flex items-center justify-between py-0.5 text-xs hover:text-primary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="size-3 text-muted-foreground" />
                    <span>Cash & Bank</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">{formatCurrency(data.totalBalance)}</span>
                </Link>
                {data.assetCount > 0 && (
                  <Link
                    href="/assets"
                    className="flex items-center justify-between py-0.5 text-xs hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3 text-muted-foreground" />
                      <span>Assets</span>
                    </div>
                    <span className="tabular-nums tx-income">{formatCurrency(data.totalAssetValue)}</span>
                  </Link>
                )}
                {data.debtCount > 0 && (
                  <Link
                    href="/debts"
                    className="flex items-center justify-between py-0.5 text-xs hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-3 text-muted-foreground" />
                      <span>Debts</span>
                    </div>
                    <span className="tabular-nums tx-expense">-{formatCurrency(data.totalDebtAmount)}</span>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link href="/transactions" className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors">
                <ArrowLeftRight className="size-3.5" />
                Add transaction
              </Link>
              <Link href="/budgets" className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors">
                <BarChart3 className="size-3.5" />
                Review budget
              </Link>
              <Link href="/reports" className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors">
                <BarChart3 className="size-3.5" />
                View reports
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
