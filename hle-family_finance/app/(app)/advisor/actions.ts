"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { generateAdvisorReport, type AdvisorReport } from "@/lib/claude-api";

export type AdvisorResult = { report: AdvisorReport } | { error: string };

export async function generateInsightsAction(): Promise<AdvisorResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household" };

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const firstOfPrev1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfPrev1 = new Date(now.getFullYear(), now.getMonth(), 0);
  const firstOfPrev2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const lastOfPrev2 = new Date(now.getFullYear(), now.getMonth() - 1, 0);

  const [accounts, debts, bills, recurring, assets, budgets] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      select: { name: true, type: true, currentBalance: true, institution: true },
    }),
    prisma.debt.findMany({
      where: { householdId, isArchived: false },
      select: { name: true, type: true, currentBalance: true, interestRate: true, minimumPayment: true, originalPrincipal: true },
    }),
    prisma.monthlyBill.findMany({
      where: { householdId, isActive: true },
      select: { name: true, category: true, expectedAmount: true, autoPay: true },
    }),
    prisma.recurringTransaction.findMany({
      where: { householdId, isActive: true },
      select: { name: true, amount: true, frequency: true, type: true },
    }),
    prisma.asset.aggregate({
      where: { householdId, isArchived: false, includeInNetWorth: true },
      _sum: { currentValue: true },
    }),
    prisma.budget.findMany({
      where: { householdId, year: now.getFullYear(), month: now.getMonth() + 1 },
      include: { category: { select: { name: true } } },
    }),
  ]);

  // Get spending by category for current and previous months
  const [currentTx, prev1Tx, prev2Tx] = await Promise.all([
    getMonthSummary(householdId, firstOfMonth, lastOfMonth),
    getMonthSummary(householdId, firstOfPrev1, lastOfPrev1),
    getMonthSummary(householdId, firstOfPrev2, lastOfPrev2),
  ]);

  const totalCash = accounts.reduce((s, a) => s + Number(a.currentBalance), 0);
  const totalDebts = debts.reduce((s, d) => s + Number(d.currentBalance), 0);
  const totalAssets = Number(assets._sum.currentValue || 0);
  const netWorth = totalCash + totalAssets - totalDebts;

  // Get actual spending per budget category — one GROUP BY instead of N aggregates
  type ActualRow = { categoryId: string | null; actual: number };
  const actualRows = await prisma.$queryRaw<ActualRow[]>`
    SELECT "categoryId", COALESCE(SUM(amount)::float, 0) AS actual
    FROM family_finance."Transaction"
    WHERE "householdId" = ${householdId}
      AND type = 'EXPENSE'
      AND "isBalanceAdjustment" = false
      AND date >= ${firstOfMonth}
      AND date <= ${lastOfMonth}
    GROUP BY "categoryId"
  `;
  const actualMap = new Map(actualRows.map((r) => [r.categoryId, r.actual]));

  const budgetData = budgets.map((b) => ({
    category: b.category.name,
    budgeted: Number(b.amount),
    actual:   Math.abs(actualMap.get(b.categoryId) ?? 0),
  }));

  const snapshot = {
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      balance: Number(a.currentBalance),
      institution: a.institution,
    })),
    currentMonth: currentTx,
    previousMonths: [
      { month: formatMonth(firstOfPrev1), ...prev1Tx },
      { month: formatMonth(firstOfPrev2), ...prev2Tx },
    ],
    debts: debts.map((d) => ({
      name: d.name,
      type: d.type,
      balance: Number(d.currentBalance),
      rate: Number(d.interestRate),
      minimumPayment: d.minimumPayment ? Number(d.minimumPayment) : null,
      originalPrincipal: Number(d.originalPrincipal),
    })),
    bills: bills.map((b) => ({
      name: b.name,
      category: b.category,
      amount: Number(b.expectedAmount),
      autoPay: b.autoPay,
    })),
    recurring: recurring.map((r) => ({
      name: r.name,
      amount: Number(r.amount),
      frequency: r.frequency,
      type: r.type,
    })),
    budgets: budgetData,
    netWorth,
    totalAssets,
    totalDebts,
    totalCash,
  };

  const result = await generateAdvisorReport(snapshot);
  if (!result.success || !result.data) {
    return { error: result.error || "Failed to generate insights" };
  }

  // Cache the report
  await prisma.advisorReport.create({
    data: {
      householdId,
      reportData: JSON.parse(JSON.stringify(result.data)),
    },
  });

  revalidatePath("/advisor");
  revalidatePath("/dashboard");
  return { report: result.data };
}

export async function getCachedReportAction(): Promise<AdvisorResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  const cached = await prisma.advisorReport.findFirst({
    where: { householdId },
    orderBy: { generatedAt: "desc" },
  });

  if (!cached) return null;
  return { report: cached.reportData as unknown as AdvisorReport };
}

async function getMonthSummary(householdId: string, start: Date, end: Date) {
  type SummaryRow = { type: string; categoryName: string | null; total: number };

  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      t.type,
      c.name                            AS "categoryName",
      COALESCE(SUM(t.amount)::float, 0) AS total
    FROM family_finance."Transaction" t
    LEFT JOIN family_finance."Category" c ON c.id = t."categoryId"
    WHERE t."householdId" = ${householdId}
      AND t.date >= ${start}
      AND t.date <= ${end}
      AND t."isBalanceAdjustment" = false
      AND t.type IN ('INCOME', 'EXPENSE')
    GROUP BY t.type, c.name
  `;

  let income = 0;
  let expenses = 0;
  const byCategory: Record<string, number> = {};

  for (const row of rows) {
    const abs = Math.abs(row.total);
    if (row.type === "INCOME") {
      income += abs;
    } else {
      expenses += abs;
      const cat = row.categoryName ?? "Uncategorized";
      byCategory[cat] = (byCategory[cat] ?? 0) + abs;
    }
  }

  return {
    income,
    expenses,
    savings: income - expenses,
    byCategory: Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15),
  };
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
