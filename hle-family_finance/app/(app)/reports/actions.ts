"use server";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export type SpendingByCategory = {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  total: number;
  count: number;
  percentage: number;
};

export type MonthlyTrend = {
  year: number;
  month: number;
  label: string;
  income: number;
  expenses: number;
  net: number;
};

export type CashFlowData = {
  monthlyTrends: MonthlyTrend[];
  spendingByCategory: SpendingByCategory[];
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  averageMonthlyExpense: number;
  averageMonthlyIncome: number;
  topExpenseCategories: SpendingByCategory[];
};

type RawCategoryRow = {
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  type: string;
  total: number;
  count: number;
};

type RawTrendRow = {
  year: number;
  month: number;
  type: string;
  total: number;
};

export async function getReportData(
  year: number,
  month?: number
): Promise<CashFlowData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  const startDate = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const endDate   = month ? new Date(year, month, 0)     : new Date(year, 11, 31);

  const trendStart = new Date(endDate);
  trendStart.setMonth(trendStart.getMonth() - 11);
  trendStart.setDate(1);

  const [rawCategory, rawTrend] = await Promise.all([
    // Spending/income by category for the selected period
    prisma.$queryRaw<RawCategoryRow[]>`
      SELECT
        t."categoryId",
        c.name                            AS "categoryName",
        c.color                           AS "categoryColor",
        t.type,
        COALESCE(SUM(t.amount)::float, 0) AS total,
        COUNT(*)::int                     AS count
      FROM family_finance."Transaction" t
      LEFT JOIN family_finance."Category" c ON c.id = t."categoryId"
      WHERE t."householdId" = ${householdId}
        AND t.date >= ${startDate}
        AND t.date <= ${endDate}
        AND t.type IN ('INCOME', 'EXPENSE')
      GROUP BY t."categoryId", c.name, c.color, t.type
      ORDER BY SUM(t.amount) DESC
    `,
    // Monthly income/expense totals for the trailing 12-month trend
    prisma.$queryRaw<RawTrendRow[]>`
      SELECT
        EXTRACT(YEAR  FROM date)::int      AS year,
        EXTRACT(MONTH FROM date)::int      AS month,
        type,
        COALESCE(SUM(amount)::float, 0)   AS total
      FROM family_finance."Transaction"
      WHERE "householdId" = ${householdId}
        AND date >= ${trendStart}
        AND date <= ${endDate}
        AND type IN ('INCOME', 'EXPENSE')
      GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date), type
      ORDER BY year, month
    `,
  ]);

  let totalIncome = 0;
  let totalExpenses = 0;
  const catMap = new Map<string, { name: string; color: string; total: number; count: number }>();

  for (const row of rawCategory) {
    if (row.type === "INCOME") {
      totalIncome += row.total;
    } else {
      totalExpenses += row.total;
      const key = row.categoryId ?? "uncategorized";
      catMap.set(key, {
        name:  row.categoryName  ?? "Uncategorized",
        color: row.categoryColor ?? "#94a3b8",
        total: row.total,
        count: row.count,
      });
    }
  }

  const spendingByCategory: SpendingByCategory[] = Array.from(catMap.entries())
    .map(([id, data]) => ({
      categoryId:    id === "uncategorized" ? null : id,
      categoryName:  data.name,
      categoryColor: data.color,
      total:         data.total,
      count:         data.count,
      percentage:    totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const trendMap = new Map<string, { income: number; expenses: number }>();
  for (const row of rawTrend) {
    const key = `${row.year}-${row.month}`;
    const existing = trendMap.get(key) ?? { income: 0, expenses: 0 };
    if (row.type === "INCOME") existing.income += row.total;
    else existing.expenses += row.total;
    trendMap.set(key, existing);
  }

  const monthlyTrends: MonthlyTrend[] = [];
  const cursor = new Date(trendStart);
  while (cursor <= endDate) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const key = `${y}-${m}`;
    const data = trendMap.get(key) ?? { income: 0, expenses: 0 };
    monthlyTrends.push({
      year:  y,
      month: m,
      label: cursor.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      income:   data.income,
      expenses: data.expenses,
      net:      data.income - data.expenses,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const monthCount = monthlyTrends.filter((m) => m.income > 0 || m.expenses > 0).length || 1;
  const netSavings = totalIncome - totalExpenses;

  return {
    monthlyTrends,
    spendingByCategory,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate:            totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0,
    averageMonthlyExpense:  totalExpenses / monthCount,
    averageMonthlyIncome:   totalIncome   / monthCount,
    topExpenseCategories:   spendingByCategory.slice(0, 10),
  };
}

export async function exportTransactionsCSV(year: number): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "";
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return "";

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      date: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      },
    },
    include: { category: true, account: true },
    orderBy: { date: "asc" },
  });

  const header = "Date,Type,Amount,Payee,Description,Category,Account,Tags";
  const rows = transactions.map((tx) => {
    const date   = new Date(tx.date).toISOString().split("T")[0];
    const amount = tx.type === "EXPENSE" ? `-${tx.amount}` : String(tx.amount);
    const payee  = csvEscape(tx.payee || "");
    const desc   = csvEscape(tx.description || "");
    const cat    = csvEscape(tx.category?.name || "Uncategorized");
    const acct   = csvEscape(tx.account.name);
    const tags   = csvEscape(tx.tags.join(", "));
    return `${date},${tx.type},${amount},${payee},${desc},${cat},${acct},${tags}`;
  });

  return [header, ...rows].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
