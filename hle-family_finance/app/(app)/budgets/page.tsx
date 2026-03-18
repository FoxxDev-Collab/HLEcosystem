import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Copy } from "lucide-react";
import { setBudgetAction, copyBudgetFromPreviousMonth } from "./actions";

export default async function BudgetsPage({
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
  const month = parseInt(params.month || String(now.getMonth() + 1));
  const monthName = new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);

  const [categories, budgets, transactions] = await Promise.all([
    prisma.category.findMany({
      where: { householdId, type: "EXPENSE", isArchived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.budget.findMany({
      where: { householdId, year, month },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        type: "EXPENSE",
        date: { gte: firstOfMonth, lte: lastOfMonth },
      },
    }),
  ]);

  // Calculate spending per category
  const spendingByCategory = transactions.reduce(
    (acc, tx) => {
      const catId = tx.categoryId || "uncategorized";
      acc[catId] = (acc[catId] || 0) + Number(tx.amount);
      return acc;
    },
    {} as Record<string, number>
  );

  const budgetMap = new Map(budgets.map((b) => [b.categoryId, Number(b.amount)]));
  const totalBudgeted = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  // Previous/next month links
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  // --- Budget Trends (6 months) ---
  const trendMonths: { label: string; budgeted: number; spent: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const tDate = new Date(year, month - 1 - i, 1);
    const tY = tDate.getFullYear();
    const tM = tDate.getMonth() + 1;
    const tFirst = new Date(tY, tM - 1, 1);
    const tLast = new Date(tY, tM, 0);

    const [tBudgets, tTransactions] = await Promise.all([
      prisma.budget.findMany({ where: { householdId, year: tY, month: tM } }),
      prisma.transaction.aggregate({
        where: { householdId, type: "EXPENSE", date: { gte: tFirst, lte: tLast } },
        _sum: { amount: true },
      }),
    ]);

    trendMonths.push({
      label: tDate.toLocaleString("en-US", { month: "short" }),
      budgeted: tBudgets.reduce((s, b) => s + Number(b.amount), 0),
      spent: Number(tTransactions._sum.amount || 0),
    });
  }

  const trendMax = Math.max(...trendMonths.map((m) => Math.max(m.budgeted, m.spent)), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <div className="flex items-center gap-2">
          <a href={`/budgets?year=${prevYear}&month=${prevMonth}`}>
            <Button variant="outline" size="sm">&larr;</Button>
          </a>
          <span className="text-sm font-medium px-2">{monthName}</span>
          <a href={`/budgets?year=${nextYear}&month=${nextMonth}`}>
            <Button variant="outline" size="sm">&rarr;</Button>
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Budgeted</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Spent</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(totalSpent)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Remaining</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBudgeted - totalSpent >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(totalBudgeted - totalSpent)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Copy from previous */}
      {budgets.length === 0 && (
        <form action={copyBudgetFromPreviousMonth}>
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <Button variant="outline" type="submit">
            <Copy className="size-4 mr-2" />
            Copy from {new Date(prevYear, prevMonth - 1).toLocaleString("en-US", { month: "long" })}
          </Button>
        </form>
      )}

      {/* 6-Month Trend */}
      <Card>
        <CardHeader>
          <CardTitle>6-Month Trend</CardTitle>
          <CardDescription>Budget vs actual spending</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trendMonths.map((m) => (
              <div key={m.label} className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="w-10 font-medium">{m.label}</span>
                  <span>
                    Spent {formatCurrency(m.spent)}
                    {m.budgeted > 0 && <> / Budget {formatCurrency(m.budgeted)}</>}
                  </span>
                </div>
                <div className="flex gap-1 h-4">
                  <div
                    className="bg-blue-200 rounded-sm"
                    style={{ width: `${(m.budgeted / trendMax) * 100}%` }}
                    title={`Budgeted: ${formatCurrency(m.budgeted)}`}
                  />
                </div>
                <div className="flex gap-1 h-4 -mt-1">
                  <div
                    className={`rounded-sm ${m.budgeted > 0 && m.spent > m.budgeted ? "bg-red-400" : "bg-green-400"}`}
                    style={{ width: `${(m.spent / trendMax) * 100}%` }}
                    title={`Spent: ${formatCurrency(m.spent)}`}
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-4 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-200 rounded-sm" /> Budgeted</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-400 rounded-sm" /> Spent (under)</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded-sm" /> Spent (over)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget per category */}
      <Card>
        <CardHeader><CardTitle>Budget by Category</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {categories.map((cat) => {
            const budgeted = budgetMap.get(cat.id) || 0;
            const spent = spendingByCategory[cat.id] || 0;
            const percent = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
            const overBudget = budgeted > 0 && spent > budgeted;

            return (
              <div key={cat.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || "#6366f1" }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={overBudget ? "text-red-600 font-medium" : "text-muted-foreground"}>
                      {formatCurrency(spent)}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <form action={setBudgetAction} className="flex items-center gap-1">
                      <input type="hidden" name="categoryId" value={cat.id} />
                      <input type="hidden" name="year" value={year} />
                      <input type="hidden" name="month" value={month} />
                      <Input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={budgeted || ""}
                        placeholder="0"
                        className="w-24 h-7 text-sm text-right"
                      />
                      <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs">Set</Button>
                    </form>
                  </div>
                </div>
                {budgeted > 0 && (
                  <Progress value={percent} className={`h-2 ${overBudget ? "[&>div]:bg-red-500" : ""}`} />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
