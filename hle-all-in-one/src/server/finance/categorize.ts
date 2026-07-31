// Bulk categorization (legacy transactions/categorize/actions.ts + page).
// CategoryRule matching runs first (free, deterministic); only unmatched
// transactions are sent to the AI gateway. Categories the AI suggests that
// don't exist yet are auto-created as EXPENSE categories (legacy behavior).
//
// SECURITY (ADR-0005): transaction ids arrive from the client — every lookup
// and mutation is scoped by householdId. The AI prompt payload is built
// exclusively from rows already scoped to the caller's household.
import { sql } from "@/server/db"
import { categorizeTransaction, isAiConfigured } from "./claude-api"
import { listActiveRules, matchCategoryRule } from "./import"

export type UncategorizedTransactionRow = {
  id: string
  payee: string | null
  description: string | null
  amount: number
  date: string
  accountName: string
  type: string
}

export type TransactionSuggestion = {
  id: string
  payee: string | null
  description: string | null
  amount: number
  date: string
  accountName: string
  suggestedCategory: string
  suggestedCategoryId: string | null
  confidence: number
  reasoning: string
}

export type NewCategory = {
  id: string
  name: string
  color: string
}

// Colors assigned to auto-created categories in rotation (legacy palette).
const AUTO_COLORS = [
  "#22c55e",
  "#f97316",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#ec4899",
  "#0ea5e9",
  "#eab308",
  "#6366f1",
  "#a855f7",
  "#06b6d4",
  "#84cc16",
  "#f472b6",
  "#78716c",
]

export async function listUncategorized(householdId: string): Promise<{
  transactions: Array<UncategorizedTransactionRow>
  totalCount: number
}> {
  const [transactions, [countRow]] = await Promise.all([
    sql<Array<UncategorizedTransactionRow>>`
      SELECT t."id", t."payee", t."description", t."amount"::float8,
             t."date"::text, a."name" AS "accountName", t."type"
      FROM "Transaction" t
      JOIN "Account" a ON a."id" = t."accountId"
      WHERE t."householdId" = ${householdId} AND t."categoryId" IS NULL
      ORDER BY t."date" DESC, t."createdAt" DESC
      LIMIT 100`,
    sql<Array<{ count: number }>>`
      SELECT count(*)::int AS "count"
      FROM "Transaction"
      WHERE "householdId" = ${householdId} AND "categoryId" IS NULL`,
  ])
  return { transactions, totalCount: countRow.count }
}

type CategoryLite = {
  id: string
  name: string
  sortOrder: number
}

export async function bulkSuggestCategories(
  householdId: string,
  transactionIds: Array<string>
): Promise<
  | {
      suggestions: Array<TransactionSuggestion>
      newCategories: Array<NewCategory>
    }
  | { error: string }
> {
  if (transactionIds.length === 0) {
    return { suggestions: [], newCategories: [] }
  }

  // Limit batch size to avoid excessive API calls (legacy: 25).
  const batchIds = transactionIds.slice(0, 25)

  const [transactions, categories, rules] = await Promise.all([
    sql<Array<UncategorizedTransactionRow>>`
      SELECT t."id", t."payee", t."description", t."amount"::float8,
             t."date"::text, a."name" AS "accountName", t."type"
      FROM "Transaction" t
      JOIN "Account" a ON a."id" = t."accountId"
      WHERE t."id" IN ${sql(batchIds)}
        AND t."householdId" = ${householdId}
        AND t."categoryId" IS NULL
      ORDER BY t."date" DESC`,
    sql<Array<CategoryLite>>`
      SELECT "id", "name", "sortOrder" FROM "Category"
      WHERE "householdId" = ${householdId} AND NOT "isArchived"
      ORDER BY "sortOrder" ASC`,
    listActiveRules(householdId),
  ])

  if (transactions.length === 0) {
    return { suggestions: [], newCategories: [] }
  }

  const categoryNames = categories.map((c) => c.name)
  const categoryMap = new Map(
    categories.map((c) => [c.name.toLowerCase(), c.id])
  )
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))

  type RawSuggestion = Omit<TransactionSuggestion, "suggestedCategoryId">

  const rawSuggestions: Array<RawSuggestion> = []
  const needsAi: Array<UncategorizedTransactionRow> = []

  // Pass 1 — CategoryRule matching (deterministic, no API call).
  for (const tx of transactions) {
    const text = [tx.payee, tx.description].filter(Boolean).join(" — ")
    const ruleCategoryId = text.trim() ? matchCategoryRule(rules, text) : null
    const ruleCategoryName = ruleCategoryId
      ? categoryNameById.get(ruleCategoryId)
      : undefined
    if (ruleCategoryId && ruleCategoryName) {
      rawSuggestions.push({
        id: tx.id,
        payee: tx.payee,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        accountName: tx.accountName,
        suggestedCategory: ruleCategoryName,
        confidence: 1,
        reasoning: "Matched a category rule",
      })
    } else {
      needsAi.push(tx)
    }
  }

  // Pass 2 — AI suggestions for whatever the rules didn't cover.
  if (needsAi.length > 0 && !isAiConfigured()) {
    if (rawSuggestions.length === 0) {
      return { error: "AI gateway not configured" }
    }
    // Rules produced something — return those instead of failing outright.
  } else {
    // Process in parallel with a small concurrency limit (legacy: 5).
    const batchSize = 5
    for (let i = 0; i < needsAi.length; i += batchSize) {
      const batch = needsAi.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async (tx) => {
          const text = [tx.payee, tx.description].filter(Boolean).join(" — ")
          if (!text.trim()) return null

          const result = await categorizeTransaction(
            text,
            tx.payee ?? undefined,
            tx.amount,
            categoryNames
          )
          if (!result.success || !result.data) return null

          return {
            id: tx.id,
            payee: tx.payee,
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
            accountName: tx.accountName,
            suggestedCategory: result.data.category,
            confidence: result.data.confidence,
            reasoning: result.data.reasoning,
          }
        })
      )
      for (const r of results) {
        if (r) rawSuggestions.push(r)
      }
    }
  }

  // Auto-create categories the AI suggested that don't exist yet.
  const newCategoryNames = new Set<string>()
  for (const s of rawSuggestions) {
    if (!categoryMap.has(s.suggestedCategory.toLowerCase())) {
      newCategoryNames.add(s.suggestedCategory)
    }
  }

  const newCategories: Array<NewCategory> = []
  const maxSortOrder =
    categories.length > 0 ? Math.max(...categories.map((c) => c.sortOrder)) : -1
  let nextSort = maxSortOrder + 1
  let colorIdx = categories.length % AUTO_COLORS.length

  for (const name of newCategoryNames) {
    const color = AUTO_COLORS[colorIdx % AUTO_COLORS.length]
    colorIdx++

    const [created] = await sql<Array<{ id: string }>>`
      INSERT INTO "Category" ("householdId", "name", "type", "color", "sortOrder")
      VALUES (${householdId}, ${name}, 'EXPENSE', ${color}, ${nextSort++})
      RETURNING "id"`

    categoryMap.set(name.toLowerCase(), created.id)
    newCategories.push({ id: created.id, name, color })
  }

  const suggestions: Array<TransactionSuggestion> = rawSuggestions.map((s) => ({
    ...s,
    suggestedCategoryId:
      categoryMap.get(s.suggestedCategory.toLowerCase()) ?? null,
  }))

  return { suggestions, newCategories }
}

export async function applyCategory(
  householdId: string,
  transactionId: string,
  categoryId: string
): Promise<{ ok: true } | { error: string }> {
  // Verify BOTH ids belong to this household (ADR-0005).
  const [[tx], [category]] = await Promise.all([
    sql<Array<{ id: string }>>`
      SELECT "id" FROM "Transaction"
      WHERE "id" = ${transactionId} AND "householdId" = ${householdId}`,
    sql<Array<{ id: string }>>`
      SELECT "id" FROM "Category"
      WHERE "id" = ${categoryId} AND "householdId" = ${householdId}`,
  ])
  if (!tx || !category) return { error: "Transaction or category not found" }

  await sql`
    UPDATE "Transaction"
    SET "categoryId" = ${categoryId}, "updatedAt" = now()
    WHERE "id" = ${tx.id} AND "householdId" = ${householdId}`
  return { ok: true }
}

export async function bulkApplyCategories(
  householdId: string,
  assignments: Array<{ transactionId: string; categoryId: string }>
): Promise<{ applied: number }> {
  let applied = 0
  for (const { transactionId, categoryId } of assignments) {
    const result = await applyCategory(householdId, transactionId, categoryId)
    if ("ok" in result) applied++
  }
  return { applied }
}
