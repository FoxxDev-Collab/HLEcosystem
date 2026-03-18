import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";

async function getDashboardData(householdId: string) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [accounts, monthlyTransactions, recentTransactions] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: firstOfMonth, lte: lastOfMonth },
      },
      include: { category: true, account: true },
    }),
    prisma.transaction.findMany({
      where: { householdId },
      include: { category: true, account: true },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const monthlyIncome = monthlyTransactions
    .filter((t) => t.type === "INCOME" && !t.isBalanceAdjustment)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlyExpenses = monthlyTransactions
    .filter((t) => t.type === "EXPENSE" && !t.isBalanceAdjustment)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlySavings = monthlyIncome - monthlyExpenses;

  return { accounts, totalBalance, monthlyIncome, monthlyExpenses, monthlySavings, recentTransactions };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const data = await getDashboardData(householdId);
  const monthName = new Date().toLocaleString("en-US", { month: "long" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user.name}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalBalance)}</div>
            <p className="text-xs text-muted-foreground">
              Across {data.accounts.length} account{data.accounts.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{monthName} Income</CardTitle>
            <TrendingUp className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(data.monthlyIncome)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{monthName} Expenses</CardTitle>
            <TrendingDown className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(data.monthlyExpenses)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
            <PiggyBank className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.monthlySavings >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(data.monthlySavings)}
            </div>
            <p className="text-xs text-muted-foreground">Income minus expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts & Recent Transactions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>Your financial accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {data.accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No accounts yet. Add your first account to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {data.accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: account.color || "#6366f1" }}
                      />
                      <div>
                        <div className="text-sm font-medium">{account.name}</div>
                        <div className="text-xs text-muted-foreground">{account.institution || account.type}</div>
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${Number(account.currentBalance) < 0 ? "text-red-600" : ""}`}>
                      {formatCurrency(account.currentBalance)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Last 10 transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No transactions yet. Add your first transaction.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{tx.payee || tx.description || "Transaction"}</div>
                      <div className="text-xs text-muted-foreground">
                        {tx.category?.name || "Uncategorized"} &middot; {tx.account.name}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        tx.type === "INCOME" ? "text-green-600" : tx.type === "EXPENSE" ? "text-red-600" : ""
                      }`}
                    >
                      {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
