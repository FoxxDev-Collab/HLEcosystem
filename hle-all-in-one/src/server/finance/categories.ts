// Finance categories (legacy categories/actions.ts + lib/default-categories.ts)
// plus CategoryRule queries (rules are category metadata; the bulk-categorize
// and import features consume them). Two-level hierarchy via parentCategoryId;
// unique (householdId, name, parentCategoryId) — NULL parents are distinct.
import { sql } from "@/server/db"

export type CategoryType = "INCOME" | "EXPENSE" | "TRANSFER"

export type CategoryRow = {
  id: string
  parentCategoryId: string | null
  name: string
  type: CategoryType
  icon: string | null
  color: string | null
  isArchived: boolean
  transactionCount: number
}

// Shape consumed by other finance features (transactions, budgets, bills,
// categorize, import). Active (non-archived) categories only.
export type CategoryPickerRow = {
  id: string
  name: string
  type: CategoryType
  parentCategoryId: string | null
}

export type CategoryRuleMatchType =
  | "CONTAINS"
  | "STARTS_WITH"
  | "EXACT"
  | "REGEX"

export type CategoryRuleRow = {
  id: string
  pattern: string
  matchType: CategoryRuleMatchType
  categoryId: string
  categoryName: string
  assignPayee: string | null
  priority: number
  isActive: boolean
  matchCount: number
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const code = (err as { code?: unknown }).code
  const message = (err as { message?: unknown }).message
  return (
    code === "23505" ||
    (typeof message === "string" && message.includes("duplicate key"))
  )
}

export async function listCategories(
  householdId: string
): Promise<Array<CategoryRow>> {
  return sql<Array<CategoryRow>>`
    SELECT c."id", c."parentCategoryId", c."name", c."type", c."icon",
           c."color", c."isArchived",
           (SELECT count(*)::int FROM "Transaction" t
             WHERE t."categoryId" = c."id") AS "transactionCount"
    FROM "Category" c
    WHERE c."householdId" = ${householdId}
    ORDER BY c."isArchived" ASC, c."sortOrder" ASC, c."name" ASC`
}

export async function listCategoriesForPicker(
  householdId: string
): Promise<Array<CategoryPickerRow>> {
  return sql<Array<CategoryPickerRow>>`
    SELECT "id", "name", "type", "parentCategoryId"
    FROM "Category"
    WHERE "householdId" = ${householdId} AND NOT "isArchived"
    ORDER BY "sortOrder" ASC, "name" ASC`
}

export type CategoryInput = {
  name: string
  type: CategoryType
  icon: string | null
  color: string | null
  parentCategoryId: string | null
}

export async function createCategory(
  householdId: string,
  input: CategoryInput
): Promise<{ ok: true } | { error: string }> {
  if (input.parentCategoryId) {
    // Re-verify the parent belongs to this household and is top-level
    // (one level of nesting, matching the legacy model).
    const [parent] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Category"
      WHERE "id" = ${input.parentCategoryId}
        AND "householdId" = ${householdId}
        AND "parentCategoryId" IS NULL`
    if (!parent) return { error: "Parent category not found" }
  }
  try {
    await sql`
      INSERT INTO "Category" (
        "householdId", "name", "type", "icon", "color", "parentCategoryId"
      ) VALUES (
        ${householdId}, ${input.name}, ${input.type}, ${input.icon},
        ${input.color}, ${input.parentCategoryId}
      )`
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "A category with that name already exists" }
    }
    throw err
  }
  return { ok: true }
}

export async function updateCategory(
  householdId: string,
  id: string,
  name: string,
  color: string | null
): Promise<{ ok: true } | { error: string }> {
  try {
    await sql`
      UPDATE "Category"
      SET "name" = ${name}, "color" = ${color}
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "A category with that name already exists" }
    }
    throw err
  }
  return { ok: true }
}

export async function setCategoryArchived(
  householdId: string,
  id: string,
  isArchived: boolean
): Promise<void> {
  await sql`
    UPDATE "Category"
    SET "isArchived" = ${isArchived}
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

// ---------------------------------------------------------------------------
// Default category seeding (legacy lib/default-categories.ts, wired to an
// empty-state "Seed defaults" button per the port plan).
// ---------------------------------------------------------------------------

type CategorySeed = { name: string; icon: string; color: string }

const EXPENSE_CATEGORIES: Array<CategorySeed> = [
  { name: "Groceries", icon: "shopping-cart", color: "#22c55e" },
  { name: "Dining Out", icon: "utensils", color: "#f97316" },
  { name: "Gas & Fuel", icon: "fuel", color: "#eab308" },
  { name: "Utilities", icon: "zap", color: "#3b82f6" },
  { name: "Rent / Mortgage", icon: "home", color: "#8b5cf6" },
  { name: "Insurance", icon: "shield", color: "#6366f1" },
  { name: "Medical & Health", icon: "heart-pulse", color: "#ef4444" },
  { name: "Transportation", icon: "car", color: "#14b8a6" },
  { name: "Entertainment", icon: "tv", color: "#ec4899" },
  { name: "Shopping", icon: "shopping-bag", color: "#a855f7" },
  { name: "Subscriptions", icon: "repeat", color: "#0ea5e9" },
  { name: "Education", icon: "graduation-cap", color: "#06b6d4" },
  { name: "Personal Care", icon: "scissors", color: "#f472b6" },
  { name: "Clothing", icon: "shirt", color: "#d946ef" },
  { name: "Home Maintenance", icon: "wrench", color: "#78716c" },
  { name: "Childcare", icon: "baby", color: "#fb923c" },
  { name: "Pets", icon: "paw-print", color: "#84cc16" },
  { name: "Gifts & Donations", icon: "gift", color: "#e11d48" },
  { name: "Travel", icon: "plane", color: "#0284c7" },
  { name: "Taxes", icon: "landmark", color: "#475569" },
  { name: "Fees & Charges", icon: "receipt", color: "#94a3b8" },
  { name: "Miscellaneous", icon: "ellipsis", color: "#71717a" },
]

const INCOME_CATEGORIES: Array<CategorySeed> = [
  { name: "Salary", icon: "briefcase", color: "#22c55e" },
  { name: "Freelance / Side Hustle", icon: "laptop", color: "#10b981" },
  { name: "Investment Income", icon: "trending-up", color: "#0ea5e9" },
  { name: "Rental Income", icon: "building", color: "#8b5cf6" },
  { name: "Refunds", icon: "rotate-ccw", color: "#6366f1" },
  { name: "Gifts Received", icon: "gift", color: "#f59e0b" },
  { name: "Other Income", icon: "plus-circle", color: "#64748b" },
]

const TRANSFER_CATEGORIES: Array<CategorySeed> = [
  { name: "Transfer", icon: "arrow-left-right", color: "#94a3b8" },
  { name: "Credit Card Payment", icon: "credit-card", color: "#64748b" },
  { name: "Savings Transfer", icon: "piggy-bank", color: "#22c55e" },
  { name: "Investment Transfer", icon: "trending-up", color: "#3b82f6" },
]

export async function seedDefaultCategories(
  householdId: string
): Promise<{ ok: true } | { error: string }> {
  const [row] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count"
    FROM "Category" WHERE "householdId" = ${householdId}`
  if (row.count > 0) return { error: "Categories already exist" }

  const all: Array<CategorySeed & { type: CategoryType }> = [
    ...EXPENSE_CATEGORIES.map((c) => ({ ...c, type: "EXPENSE" as const })),
    ...INCOME_CATEGORIES.map((c) => ({ ...c, type: "INCOME" as const })),
    ...TRANSFER_CATEGORIES.map((c) => ({ ...c, type: "TRANSFER" as const })),
  ]
  await sql.begin(async (tx) => {
    for (const [sortOrder, cat] of all.entries()) {
      await tx`
        INSERT INTO "Category" (
          "householdId", "name", "type", "icon", "color", "sortOrder"
        ) VALUES (
          ${householdId}, ${cat.name}, ${cat.type}, ${cat.icon},
          ${cat.color}, ${sortOrder}
        )`
    }
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// CategoryRule — auto-categorization rules (consumed by the categorize and
// bank-import features; managed minimally from the categories page).
// ---------------------------------------------------------------------------

export async function listCategoryRules(
  householdId: string
): Promise<Array<CategoryRuleRow>> {
  return sql<Array<CategoryRuleRow>>`
    SELECT r."id", r."pattern", r."matchType", r."categoryId",
           c."name" AS "categoryName", r."assignPayee", r."priority",
           r."isActive", r."matchCount"
    FROM "CategoryRule" r
    JOIN "Category" c ON c."id" = r."categoryId"
    WHERE r."householdId" = ${householdId}
    ORDER BY r."priority" DESC, r."pattern" ASC`
}

export type CategoryRuleInput = {
  pattern: string
  matchType: CategoryRuleMatchType
  categoryId: string
  assignPayee: string | null
  priority: number
}

export async function createCategoryRule(
  householdId: string,
  input: CategoryRuleInput
): Promise<{ ok: true } | { error: string }> {
  // Re-verify the target category belongs to this household (ADR-0005).
  const [category] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Category"
    WHERE "id" = ${input.categoryId} AND "householdId" = ${householdId}`
  if (!category) return { error: "Category not found" }

  await sql`
    INSERT INTO "CategoryRule" (
      "householdId", "pattern", "matchType", "categoryId", "assignPayee",
      "priority"
    ) VALUES (
      ${householdId}, ${input.pattern}, ${input.matchType},
      ${input.categoryId}, ${input.assignPayee}, ${input.priority}
    )`
  return { ok: true }
}

export async function deleteCategoryRule(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    DELETE FROM "CategoryRule"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}
