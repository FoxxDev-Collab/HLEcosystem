// AI financial advisor (legacy advisor/actions.ts): builds a finance summary
// snapshot, sends it to the Claude API gateway, and caches the structured
// report in "AdvisorReport" (JSONB). The page shows the latest cached report.
//
// SECURITY: the snapshot sent to the gateway is built EXCLUSIVELY from
// queries scoped to the caller's householdId — nothing from another tenant
// can reach the prompt.
import { sql } from "@/server/db"
import { generateAdvisorReport } from "./claude-api"
import type { AdvisorReportData } from "./claude-api"

export type CachedAdvisorReport = {
  report: AdvisorReportData
  generatedAt: Date
}

function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

type MonthSummary = {
  income: number
  expenses: number
  savings: number
  byCategory: Array<{ category: string; amount: number }>
}

async function getMonthSummary(
  householdId: string,
  start: string,
  end: string
): Promise<MonthSummary> {
  const rows = await sql<
    Array<{ type: string; categoryName: string | null; total: number }>
  >`
    SELECT t."type", c."name" AS "categoryName",
           COALESCE(SUM(t."amount")::float8, 0) AS "total"
    FROM "Transaction" t
    LEFT JOIN "Category" c ON c."id" = t."categoryId"
    WHERE t."householdId" = ${householdId}
      AND t."date" >= ${start}::date
      AND t."date" <= ${end}::date
      AND t."isBalanceAdjustment" = false
      AND t."type" IN ('INCOME', 'EXPENSE')
    GROUP BY t."type", c."name"`

  let income = 0
  let expenses = 0
  const byCategory: Record<string, number> = {}

  for (const row of rows) {
    const abs = Math.abs(row.total)
    if (row.type === "INCOME") {
      income += abs
    } else {
      expenses += abs
      const cat = row.categoryName ?? "Uncategorized"
      byCategory[cat] = (byCategory[cat] ?? 0) + abs
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
  }
}

// Same aggregates as the legacy generateInsightsAction snapshot.
async function buildFinanceSnapshot(
  householdId: string
): Promise<Record<string, unknown>> {
  const now = new Date()
  const firstOfMonth = ymd(new Date(now.getFullYear(), now.getMonth(), 1))
  const lastOfMonth = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const prev1Start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prev1End = new Date(now.getFullYear(), now.getMonth(), 0)
  const prev2Start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const prev2End = new Date(now.getFullYear(), now.getMonth() - 1, 0)

  const [accounts, debts, bills, recurring, [assetSum], budgets] =
    await Promise.all([
      sql<
        Array<{
          name: string
          type: string
          balance: number
          institution: string | null
        }>
      >`
        SELECT "name", "type", "currentBalance"::float8 AS "balance",
               "institution"
        FROM "Account"
        WHERE "householdId" = ${householdId} AND NOT "isArchived"`,
      sql<
        Array<{
          name: string
          type: string
          balance: number
          rate: number
          minimumPayment: number | null
          originalPrincipal: number
        }>
      >`
        SELECT "name", "type", "currentBalance"::float8 AS "balance",
               "interestRate"::float8 AS "rate",
               "minimumPayment"::float8, "originalPrincipal"::float8
        FROM "Debt"
        WHERE "householdId" = ${householdId} AND NOT "isArchived"`,
      sql<
        Array<{
          name: string
          category: string
          amount: number
          autoPay: boolean
        }>
      >`
        SELECT "name", "category", "expectedAmount"::float8 AS "amount",
               "autoPay"
        FROM "MonthlyBill"
        WHERE "householdId" = ${householdId} AND "isActive"`,
      sql<
        Array<{
          name: string
          amount: number
          frequency: string
          type: string
        }>
      >`
        SELECT "name", "amount"::float8, "frequency", "type"
        FROM "RecurringTransaction"
        WHERE "householdId" = ${householdId} AND "isActive"`,
      sql<Array<{ total: number }>>`
        SELECT COALESCE(SUM("currentValue"), 0)::float8 AS "total"
        FROM "Asset"
        WHERE "householdId" = ${householdId}
          AND NOT "isArchived" AND "includeInNetWorth"`,
      sql<Array<{ categoryId: string; category: string; budgeted: number }>>`
        SELECT b."categoryId", c."name" AS "category",
               b."amount"::float8 AS "budgeted"
        FROM "Budget" b
        JOIN "Category" c ON c."id" = b."categoryId"
        WHERE b."householdId" = ${householdId}
          AND b."year" = ${now.getFullYear()}
          AND b."month" = ${now.getMonth() + 1}`,
    ])

  const [currentTx, prev1Tx, prev2Tx] = await Promise.all([
    getMonthSummary(householdId, firstOfMonth, lastOfMonth),
    getMonthSummary(householdId, ymd(prev1Start), ymd(prev1End)),
    getMonthSummary(householdId, ymd(prev2Start), ymd(prev2End)),
  ])

  const totalCash = accounts.reduce((s, a) => s + a.balance, 0)
  const totalDebts = debts.reduce((s, d) => s + d.balance, 0)
  const totalAssets = assetSum.total
  const netWorth = totalCash + totalAssets - totalDebts

  // Actual spending per budget category — one GROUP BY (legacy optimization).
  const actualRows = await sql<
    Array<{ categoryId: string | null; actual: number }>
  >`
    SELECT "categoryId", COALESCE(SUM("amount")::float8, 0) AS "actual"
    FROM "Transaction"
    WHERE "householdId" = ${householdId}
      AND "type" = 'EXPENSE'
      AND "isBalanceAdjustment" = false
      AND "date" >= ${firstOfMonth}::date
      AND "date" <= ${lastOfMonth}::date
    GROUP BY "categoryId"`
  const actualMap = new Map(actualRows.map((r) => [r.categoryId, r.actual]))

  return {
    accounts,
    currentMonth: currentTx,
    previousMonths: [
      { month: formatMonth(prev1Start), ...prev1Tx },
      { month: formatMonth(prev2Start), ...prev2Tx },
    ],
    debts,
    bills,
    recurring,
    budgets: budgets.map((b) => ({
      category: b.category,
      budgeted: b.budgeted,
      actual: Math.abs(actualMap.get(b.categoryId) ?? 0),
    })),
    netWorth,
    totalAssets,
    totalDebts,
    totalCash,
  }
}

export async function getLatestReport(
  householdId: string
): Promise<CachedAdvisorReport | null> {
  const [row] = await sql<Array<{ reportData: string; generatedAt: Date }>>`
    SELECT "reportData"::text, "generatedAt"
    FROM "AdvisorReport"
    WHERE "householdId" = ${householdId}
    ORDER BY "generatedAt" DESC
    LIMIT 1`
  if (!row) return null
  return {
    report: JSON.parse(row.reportData) as AdvisorReportData,
    generatedAt: row.generatedAt,
  }
}

export async function generateInsights(
  householdId: string
): Promise<{ report: AdvisorReportData } | { error: string }> {
  const snapshot = await buildFinanceSnapshot(householdId)

  const result = await generateAdvisorReport(snapshot)
  if (!result.success || !result.data) {
    return { error: result.error || "Failed to generate insights" }
  }

  await sql`
    INSERT INTO "AdvisorReport" ("householdId", "reportData")
    VALUES (${householdId}, ${JSON.stringify(result.data)}::jsonb)`

  return { report: result.data }
}
