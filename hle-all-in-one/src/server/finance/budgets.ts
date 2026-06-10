// Finance monthly budgets (legacy budgets/actions.ts + budgets page).
// Budget-vs-actual per EXPENSE category for a year/month; amounts upsert on
// the unique (householdId, categoryId, year, month) constraint; zero/negative
// amounts delete the row (legacy setBudgetAction semantics).
import { sql } from "@/server/db"

export type BudgetCategoryRow = {
  id: string
  name: string
  color: string | null
  parentCategoryId: string | null
  budgeted: number | null
  spent: number
}

export type BudgetTrendMonth = {
  year: number
  month: number
  budgeted: number
  spent: number
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`
}

export async function getBudgetsPage(
  householdId: string,
  year: number,
  month: number
): Promise<{
  categories: Array<BudgetCategoryRow>
  budgetCount: number
  totalBudgeted: number
  totalSpent: number
  trend: Array<BudgetTrendMonth>
}> {
  const monthStart = monthKey(year, month)

  // Trend window: this month and the 5 before it.
  const trendStartDate = new Date(year, month - 6, 1)
  const trendStart = monthKey(
    trendStartDate.getFullYear(),
    trendStartDate.getMonth() + 1
  )

  const [categories, [totals], spendRows, budgetRows] = await Promise.all([
    // EXPENSE categories with this month's budget + actual spend per category.
    sql<Array<BudgetCategoryRow>>`
      SELECT c."id", c."name", c."color", c."parentCategoryId",
             b."amount"::float8 AS "budgeted",
             COALESCE((
               SELECT SUM(t."amount")::float8 FROM "Transaction" t
               WHERE t."householdId" = ${householdId}
                 AND t."categoryId" = c."id"
                 AND t."type" = 'EXPENSE'
                 AND t."date" >= ${monthStart}::date
                 AND t."date" < (${monthStart}::date + INTERVAL '1 month')
             ), 0) AS "spent"
      FROM "Category" c
      LEFT JOIN "Budget" b
        ON b."categoryId" = c."id" AND b."householdId" = ${householdId}
       AND b."year" = ${year} AND b."month" = ${month}
      WHERE c."householdId" = ${householdId}
        AND c."type" = 'EXPENSE' AND NOT c."isArchived"
      ORDER BY c."sortOrder" ASC, c."name" ASC`,
    // Month totals: all EXPENSE spend (incl. uncategorized) + budget sum.
    sql<
      Array<{ totalSpent: number; totalBudgeted: number; budgetCount: number }>
    >`
      SELECT
        COALESCE((
          SELECT SUM(t."amount")::float8 FROM "Transaction" t
          WHERE t."householdId" = ${householdId} AND t."type" = 'EXPENSE'
            AND t."date" >= ${monthStart}::date
            AND t."date" < (${monthStart}::date + INTERVAL '1 month')
        ), 0) AS "totalSpent",
        COALESCE((
          SELECT SUM(b."amount")::float8 FROM "Budget" b
          WHERE b."householdId" = ${householdId}
            AND b."year" = ${year} AND b."month" = ${month}
        ), 0) AS "totalBudgeted",
        (SELECT count(*)::int FROM "Budget" b
          WHERE b."householdId" = ${householdId}
            AND b."year" = ${year} AND b."month" = ${month}) AS "budgetCount"`,
    // 6-month spend trend (legacy 2-query optimization).
    sql<Array<{ year: number; month: number; spent: number }>>`
      SELECT EXTRACT(YEAR FROM "date")::int AS "year",
             EXTRACT(MONTH FROM "date")::int AS "month",
             SUM("amount")::float8 AS "spent"
      FROM "Transaction"
      WHERE "householdId" = ${householdId} AND "type" = 'EXPENSE'
        AND "date" >= ${trendStart}::date
        AND "date" < (${monthStart}::date + INTERVAL '1 month')
      GROUP BY 1, 2`,
    sql<Array<{ year: number; month: number; budgeted: number }>>`
      SELECT "year", "month", SUM("amount")::float8 AS "budgeted"
      FROM "Budget"
      WHERE "householdId" = ${householdId}
        AND ("year" * 12 + "month")
          >= ${trendStartDate.getFullYear() * 12 + trendStartDate.getMonth() + 1}
        AND ("year" * 12 + "month") <= ${year * 12 + month}
      GROUP BY "year", "month"`,
  ])

  const spendMap = new Map(
    spendRows.map((r) => [`${r.year}-${r.month}`, r.spent])
  )
  const budgetMap = new Map(
    budgetRows.map((r) => [`${r.year}-${r.month}`, r.budgeted])
  )
  const trend: Array<BudgetTrendMonth> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    const tY = d.getFullYear()
    const tM = d.getMonth() + 1
    trend.push({
      year: tY,
      month: tM,
      budgeted: budgetMap.get(`${tY}-${tM}`) ?? 0,
      spent: spendMap.get(`${tY}-${tM}`) ?? 0,
    })
  }

  return {
    categories,
    budgetCount: totals.budgetCount,
    totalBudgeted: totals.totalBudgeted,
    totalSpent: totals.totalSpent,
    trend,
  }
}

export async function setBudget(
  householdId: string,
  categoryId: string,
  year: number,
  month: number,
  amount: number
): Promise<{ ok: true } | { error: string }> {
  // Re-verify the client-supplied categoryId (ADR-0005).
  const [category] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Category"
    WHERE "id" = ${categoryId} AND "householdId" = ${householdId}`
  if (!category) return { error: "Category not found" }

  if (amount <= 0) {
    // Zero clears the budget (legacy behavior).
    await sql`
      DELETE FROM "Budget"
      WHERE "householdId" = ${householdId} AND "categoryId" = ${categoryId}
        AND "year" = ${year} AND "month" = ${month}`
    return { ok: true }
  }

  await sql`
    INSERT INTO "Budget" ("householdId", "categoryId", "year", "month", "amount")
    VALUES (${householdId}, ${categoryId}, ${year}, ${month}, ${amount})
    ON CONFLICT ("householdId", "categoryId", "year", "month")
    DO UPDATE SET "amount" = EXCLUDED."amount", "updatedAt" = now()`
  return { ok: true }
}

export async function copyBudgetFromPreviousMonth(
  householdId: string,
  year: number,
  month: number
): Promise<{ copied: number }> {
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Budget" ("householdId", "categoryId", "year", "month", "amount")
    SELECT "householdId", "categoryId", ${year}, ${month}, "amount"
    FROM "Budget"
    WHERE "householdId" = ${householdId}
      AND "year" = ${prevYear} AND "month" = ${prevMonth}
    ON CONFLICT ("householdId", "categoryId", "year", "month")
    DO UPDATE SET "amount" = EXCLUDED."amount", "updatedAt" = now()
    RETURNING "id"`
  return { copied: rows.length }
}
