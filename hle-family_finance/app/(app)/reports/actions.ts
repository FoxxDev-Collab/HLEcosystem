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

export async function getReportData(
  year: number,
  month?: number
): Promise<CashFlowData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  // Date range — full year or single month
  const startDate = month
    ? new Date(year, month - 1, 1)
    : new Date(year, 0, 1);
  const endDate = month
    ? new Date(year, month, 0)
    : new Date(year, 11, 31);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      date: { gte: startDate, lte: endDate },
      type: { in: ["INCOME", "EXPENSE"] },
    },
    include: { category: true },
  });

  // Spending by category
  const catMap = new Map<string, { name: string; color: string; total: number; count: number }>();
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    if (tx.type === "INCOME") {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
      const key = tx.categoryId || "uncategorized";
      const existing = catMap.get(key) || {
        name: tx.category?.name || "Uncategorized",
        color: tx.category?.color || "#94a3b8",
        total: 0,
        count: 0,
      };
      existing.total += amount;
      existing.count += 1;
      catMap.set(key, existing);
    }
  }

  const spendingByCategory: SpendingByCategory[] = Array.from(catMap.entries())
    .map(([id, data]) => ({
      categoryId: id === "uncategorized" ? null : id,
      categoryName: data.name,
      categoryColor: data.color,
      total: data.total,
      count: data.count,
      percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Monthly trends (last 12 months from endDate)
  const trendStart = new Date(endDate);
  trendStart.setMonth(trendStart.getMonth() - 11);
  trendStart.setDate(1);

  const trendTransactions = await prisma.transaction.findMany({
    where: {
      householdId,
      date: { gte: trendStart, lte: endDate },
      type: { in: ["INCOME", "EXPENSE"] },
    },
  });

  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  for (const tx of trendTransactions) {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const existing = monthlyMap.get(key) || { income: 0, expenses: 0 };
    if (tx.type === "INCOME") existing.income += Number(tx.amount);
    else existing.expenses += Number(tx.amount);
    monthlyMap.set(key, existing);
  }

  const monthlyTrends: MonthlyTrend[] = [];
  const cursor = new Date(trendStart);
  while (cursor <= endDate) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const key = `${y}-${m}`;
    const data = monthlyMap.get(key) || { income: 0, expenses: 0 };
    monthlyTrends.push({
      year: y,
      month: m,
      label: cursor.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
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
    savingsRate: totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0,
    averageMonthlyExpense: totalExpenses / monthCount,
    averageMonthlyIncome: totalIncome / monthCount,
    topExpenseCategories: spendingByCategory.slice(0, 10),
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
    const date = new Date(tx.date).toISOString().split("T")[0];
    const amount = tx.type === "EXPENSE" ? `-${tx.amount}` : String(tx.amount);
    const payee = csvEscape(tx.payee || "");
    const desc = csvEscape(tx.description || "");
    const cat = csvEscape(tx.category?.name || "Uncategorized");
    const acct = csvEscape(tx.account.name);
    const tags = csvEscape(tx.tags.join(", "));
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
