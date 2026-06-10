// Finance reports (legacy reports/actions.ts): spending by category for a
// year or single month, trailing-12-month income/expense trend, per-account
// flows, and CSV export of a year's transactions.
import { sql } from "@/server/db"

export type SpendingByCategory = {
  categoryId: string | null
  categoryName: string
  categoryColor: string
  total: number
  count: number
  percentage: number
}

export type MonthlyTrend = {
  year: number
  month: number
  label: string
  income: number
  expenses: number
  net: number
}

export type AccountFlow = {
  accountId: string
  accountName: string
  income: number
  expenses: number
  net: number
}

export type ReportData = {
  monthlyTrends: Array<MonthlyTrend>
  spendingByCategory: Array<SpendingByCategory>
  accountFlows: Array<AccountFlow>
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  averageMonthlyExpense: number
  averageMonthlyIncome: number
  topExpenseCategories: Array<SpendingByCategory>
}

type RawCategoryRow = {
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  type: string
  total: number
  count: number
}

type RawTrendRow = {
  year: number
  month: number
  type: string
  total: number
}

type RawFlowRow = {
  accountId: string
  accountName: string
  income: number
  expenses: number
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export async function getReportData(
  householdId: string,
  year: number,
  month: number | null
): Promise<ReportData> {
  const startDate = month ? `${year}-${pad2(month)}-01` : `${year}-01-01`
  const endDate = month
    ? `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`
    : `${year}-12-31`

  // Trailing 12 months ending in the selected period's last month.
  const endYear = month ? year : year
  const endMonth = month ?? 12
  const trendStartCursor = new Date(endYear, endMonth - 1 - 11, 1)
  const trendStart = `${trendStartCursor.getFullYear()}-${pad2(trendStartCursor.getMonth() + 1)}-01`

  const [rawCategory, rawTrend, rawFlows] = await Promise.all([
    sql<Array<RawCategoryRow>>`
      SELECT t."categoryId", c."name" AS "categoryName",
             c."color" AS "categoryColor", t."type",
             COALESCE(sum(t."amount"), 0)::float8 AS "total",
             count(*)::int AS "count"
      FROM "Transaction" t
      LEFT JOIN "Category" c ON c."id" = t."categoryId"
      WHERE t."householdId" = ${householdId}
        AND t."date" >= ${startDate}::date AND t."date" <= ${endDate}::date
        AND t."type" IN ('INCOME', 'EXPENSE')
      GROUP BY t."categoryId", c."name", c."color", t."type"
      ORDER BY sum(t."amount") DESC`,
    sql<Array<RawTrendRow>>`
      SELECT EXTRACT(YEAR FROM "date")::int AS "year",
             EXTRACT(MONTH FROM "date")::int AS "month",
             "type", COALESCE(sum("amount"), 0)::float8 AS "total"
      FROM "Transaction"
      WHERE "householdId" = ${householdId}
        AND "date" >= ${trendStart}::date AND "date" <= ${endDate}::date
        AND "type" IN ('INCOME', 'EXPENSE')
      GROUP BY 1, 2, 3
      ORDER BY 1, 2`,
    sql<Array<RawFlowRow>>`
      SELECT a."id" AS "accountId", a."name" AS "accountName",
             COALESCE(sum(t."amount") FILTER (WHERE t."type" = 'INCOME'), 0)::float8 AS "income",
             COALESCE(sum(t."amount") FILTER (WHERE t."type" = 'EXPENSE'), 0)::float8 AS "expenses"
      FROM "Transaction" t
      JOIN "Account" a ON a."id" = t."accountId"
      WHERE t."householdId" = ${householdId}
        AND t."date" >= ${startDate}::date AND t."date" <= ${endDate}::date
        AND t."type" IN ('INCOME', 'EXPENSE')
      GROUP BY a."id", a."name"
      ORDER BY sum(t."amount") DESC`,
  ])

  let totalIncome = 0
  let totalExpenses = 0
  const catMap = new Map<
    string,
    { name: string; color: string; total: number; count: number }
  >()

  for (const row of rawCategory) {
    if (row.type === "INCOME") {
      totalIncome += row.total
    } else {
      totalExpenses += row.total
      const key = row.categoryId ?? "uncategorized"
      catMap.set(key, {
        name: row.categoryName ?? "Uncategorized",
        color: row.categoryColor ?? "#94a3b8",
        total: row.total,
        count: row.count,
      })
    }
  }

  const spendingByCategory: Array<SpendingByCategory> = Array.from(
    catMap.entries()
  )
    .map(([id, data]) => ({
      categoryId: id === "uncategorized" ? null : id,
      categoryName: data.name,
      categoryColor: data.color,
      total: data.total,
      count: data.count,
      percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const trendMap = new Map<string, { income: number; expenses: number }>()
  for (const row of rawTrend) {
    const key = `${row.year}-${row.month}`
    const existing = trendMap.get(key) ?? { income: 0, expenses: 0 }
    if (row.type === "INCOME") existing.income += row.total
    else existing.expenses += row.total
    trendMap.set(key, existing)
  }

  const monthlyTrends: Array<MonthlyTrend> = []
  const cursor = new Date(trendStartCursor)
  const endCursor = new Date(endYear, endMonth - 1, 1)
  while (cursor <= endCursor) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth() + 1
    const data = trendMap.get(`${y}-${m}`) ?? { income: 0, expenses: 0 }
    monthlyTrends.push({
      year: y,
      month: m,
      label: cursor.toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const accountFlows: Array<AccountFlow> = rawFlows.map((row) => ({
    accountId: row.accountId,
    accountName: row.accountName,
    income: row.income,
    expenses: row.expenses,
    net: row.income - row.expenses,
  }))

  const monthCount =
    monthlyTrends.filter((m) => m.income > 0 || m.expenses > 0).length || 1
  const netSavings = totalIncome - totalExpenses

  return {
    monthlyTrends,
    spendingByCategory,
    accountFlows,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate: totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0,
    averageMonthlyExpense: totalExpenses / monthCount,
    averageMonthlyIncome: totalIncome / monthCount,
    topExpenseCategories: spendingByCategory.slice(0, 10),
  }
}

// CSV field hardening: spreadsheet formula injection guard (leading = + - @
// gets a leading apostrophe), then RFC-4180 quoting for commas/quotes/
// newlines. Applied to every user-controlled text field.
function csvField(value: string): string {
  let v = value
  if (/^[=+\-@]/.test(v)) v = `'${v}`
  if (
    v.includes(",") ||
    v.includes('"') ||
    v.includes("\n") ||
    v.includes("\r")
  ) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

type ExportRow = {
  date: string
  type: string
  amount: number
  payee: string | null
  description: string | null
  categoryName: string | null
  accountName: string
  tags: string
}

export async function exportTransactionsCsv(
  householdId: string,
  year: number
): Promise<string> {
  const rows = await sql<Array<ExportRow>>`
    SELECT t."date"::text, t."type", t."amount"::float8, t."payee",
           t."description", c."name" AS "categoryName",
           a."name" AS "accountName",
           array_to_string(t."tags", ', ') AS "tags"
    FROM "Transaction" t
    JOIN "Account" a ON a."id" = t."accountId"
    LEFT JOIN "Category" c ON c."id" = t."categoryId"
    WHERE t."householdId" = ${householdId}
      AND t."date" >= ${`${year}-01-01`}::date
      AND t."date" <= ${`${year}-12-31`}::date
    ORDER BY t."date" ASC, t."createdAt" ASC`

  const header = "Date,Type,Amount,Payee,Description,Category,Account,Tags"
  const lines = rows.map((tx) => {
    const amount = tx.type === "EXPENSE" ? `-${tx.amount}` : String(tx.amount)
    return [
      tx.date,
      tx.type,
      amount,
      csvField(tx.payee ?? ""),
      csvField(tx.description ?? ""),
      csvField(tx.categoryName ?? "Uncategorized"),
      csvField(tx.accountName),
      csvField(tx.tags),
    ].join(",")
  })

  return [header, ...lines].join("\n")
}
