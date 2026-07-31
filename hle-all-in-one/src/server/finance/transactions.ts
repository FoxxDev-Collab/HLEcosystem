// Finance transaction ledger (legacy transactions/actions.ts + page.tsx).
//
// SECURITY (ADR-0005): every client-supplied foreign id (accountId,
// transferToAccountId, categoryId, transaction id) is re-verified against the
// caller's householdId before any mutation. The 2026-04-08 cross-tenant
// incident was exactly this bug. src/server/finance/transactions.test.ts is
// the regression test — do not weaken these checks without reading it.
//
// BALANCES: Account."currentBalance" is maintained by the
// sync_account_balance() DB trigger on Transaction INSERT/DELETE. This layer
// never updates balances. Edits that change amount/date/category are
// implemented as delete + re-insert (same id) so the trigger reverses the old
// effect and applies the new one (legacy semantics).
import { z } from "zod"
import { pgTextArray, sql } from "@/server/db"

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER"

export type TransactionRow = {
  id: string
  type: TransactionType
  amount: number
  date: string
  payee: string | null
  description: string | null
  accountId: string
  accountName: string
  transferToAccountId: string | null
  transferToAccountName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  isBalanceAdjustment: boolean
}

export const TRANSACTIONS_PAGE_SIZE = 50

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const optionalText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

// Exported so the fns layer can wire it into .inputValidator() and the
// regression test can assert the zod gate rejects bad input before any DB
// call (defense in depth — test assertion 4).
export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).nullable(),
  amount: z.coerce.number().positive(),
  date: z.string().regex(DATE_RE),
  payee: optionalText,
  description: optionalText,
  transferToAccountId: z.string().min(1).nullable(),
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>

export const updateTransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive(),
  date: z.string().regex(DATE_RE),
  categoryId: z.string().min(1).nullable(),
  payee: optionalText,
  description: optionalText,
})

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>

export type TransactionFilters = {
  type: TransactionType | null
  accountId: string | null
  categoryId: string | null
  q: string | null
  from: string | null
  to: string | null
  minAmount: number | null
  maxAmount: number | null
  page: number
}

export async function listTransactions(
  householdId: string,
  filters: TransactionFilters
): Promise<{ transactions: Array<TransactionRow>; totalCount: number }> {
  const offset = (filters.page - 1) * TRANSACTIONS_PAGE_SIZE
  const [transactions, [countRow]] = await Promise.all([
    sql<Array<TransactionRow>>`
      SELECT t."id", t."type", t."amount"::float8, t."date"::text, t."payee",
             t."description", t."accountId", a."name" AS "accountName",
             t."transferToAccountId", ta."name" AS "transferToAccountName",
             t."categoryId", c."name" AS "categoryName",
             c."color" AS "categoryColor", t."isBalanceAdjustment"
      FROM "Transaction" t
      JOIN "Account" a ON a."id" = t."accountId"
      LEFT JOIN "Account" ta ON ta."id" = t."transferToAccountId"
      LEFT JOIN "Category" c ON c."id" = t."categoryId"
      WHERE t."householdId" = ${householdId}
        AND (${filters.type}::"TransactionType" IS NULL OR t."type" = ${filters.type}::"TransactionType")
        AND (${filters.accountId}::uuid IS NULL OR t."accountId" = ${filters.accountId}::uuid)
        AND (${filters.categoryId}::uuid IS NULL OR t."categoryId" = ${filters.categoryId}::uuid)
        AND (${filters.q}::text IS NULL
             OR t."payee" ILIKE '%' || ${filters.q} || '%'
             OR t."description" ILIKE '%' || ${filters.q} || '%')
        AND (${filters.from}::date IS NULL OR t."date" >= ${filters.from}::date)
        AND (${filters.to}::date IS NULL OR t."date" <= ${filters.to}::date)
        AND (${filters.minAmount}::numeric IS NULL OR t."amount" >= ${filters.minAmount}::numeric)
        AND (${filters.maxAmount}::numeric IS NULL OR t."amount" <= ${filters.maxAmount}::numeric)
      ORDER BY t."date" DESC, t."createdAt" DESC
      LIMIT ${TRANSACTIONS_PAGE_SIZE} OFFSET ${offset}`,
    sql<Array<{ count: number }>>`
      SELECT count(*)::int AS "count"
      FROM "Transaction" t
      WHERE t."householdId" = ${householdId}
        AND (${filters.type}::"TransactionType" IS NULL OR t."type" = ${filters.type}::"TransactionType")
        AND (${filters.accountId}::uuid IS NULL OR t."accountId" = ${filters.accountId}::uuid)
        AND (${filters.categoryId}::uuid IS NULL OR t."categoryId" = ${filters.categoryId}::uuid)
        AND (${filters.q}::text IS NULL
             OR t."payee" ILIKE '%' || ${filters.q} || '%'
             OR t."description" ILIKE '%' || ${filters.q} || '%')
        AND (${filters.from}::date IS NULL OR t."date" >= ${filters.from}::date)
        AND (${filters.to}::date IS NULL OR t."date" <= ${filters.to}::date)
        AND (${filters.minAmount}::numeric IS NULL OR t."amount" >= ${filters.minAmount}::numeric)
        AND (${filters.maxAmount}::numeric IS NULL OR t."amount" <= ${filters.maxAmount}::numeric)`,
  ])
  return { transactions, totalCount: countRow.count }
}

// Recent transactions for an account detail page.
export async function listAccountTransactions(
  householdId: string,
  accountId: string,
  limit: number
): Promise<Array<TransactionRow>> {
  return sql<Array<TransactionRow>>`
    SELECT t."id", t."type", t."amount"::float8, t."date"::text, t."payee",
           t."description", t."accountId", a."name" AS "accountName",
           t."transferToAccountId", ta."name" AS "transferToAccountName",
           t."categoryId", c."name" AS "categoryName",
           c."color" AS "categoryColor", t."isBalanceAdjustment"
    FROM "Transaction" t
    JOIN "Account" a ON a."id" = t."accountId"
    LEFT JOIN "Account" ta ON ta."id" = t."transferToAccountId"
    LEFT JOIN "Category" c ON c."id" = t."categoryId"
    WHERE t."householdId" = ${householdId} AND t."accountId" = ${accountId}
    ORDER BY t."date" DESC, t."createdAt" DESC
    LIMIT ${limit}`
}

export async function createTransaction(
  householdId: string,
  userId: string,
  input: CreateTransactionInput
): Promise<{ ok: true } | { error: string }> {
  const amount = Math.abs(input.amount)
  const transferToAccountId =
    input.type === "TRANSFER" ? input.transferToAccountId : null
  const categoryId = input.categoryId

  // Tenant scoping (ADR-0005): verify the account(s) belong to this
  // household before mutating anything. BOTH legs of a transfer.
  const [account] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "householdId" = ${householdId}`
  if (!account) return { error: "Account not found" }

  if (input.type === "TRANSFER") {
    if (!transferToAccountId) {
      return { error: "Transfer destination account is required" }
    }
    if (transferToAccountId === input.accountId) {
      return { error: "Cannot transfer to the same account" }
    }
    const [destAccount] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Account"
      WHERE "id" = ${transferToAccountId} AND "householdId" = ${householdId}`
    if (!destAccount) return { error: "Destination account not found" }
  }

  if (categoryId) {
    const [category] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Category"
      WHERE "id" = ${categoryId} AND "householdId" = ${householdId}`
    if (!category) return { error: "Category not found" }
  }

  await sql`
    INSERT INTO "Transaction" (
      "householdId", "type", "accountId", "categoryId", "amount", "date",
      "payee", "description", "transferToAccountId", "createdByUserId"
    ) VALUES (
      ${householdId}, ${input.type}, ${input.accountId}, ${categoryId},
      ${amount}, ${input.date}, ${input.payee}, ${input.description},
      ${transferToAccountId}, ${userId}
    )`
  // Account balance(s) are updated by the sync_account_balance DB trigger.
  return { ok: true }
}

type ExistingTransactionRow = {
  id: string
  accountId: string
  transferToAccountId: string | null
  recurringTransactionId: string | null
  type: TransactionType
  isReconciled: boolean
  isCleared: boolean
  isBalanceAdjustment: boolean
  tags: Array<string>
  externalId: string | null
  createdByUserId: string | null
  createdAt: Date
}

// Edit = delete + re-insert with the same id (legacy semantics): the DELETE
// reverses the old balance effect via the trigger and the INSERT applies the
// new one. Type and account are not editable — change those by deleting and
// recreating the transaction from the ledger.
export async function updateTransaction(
  householdId: string,
  input: UpdateTransactionInput
): Promise<{ ok: true } | { error: string }> {
  const [existing] = await sql<Array<ExistingTransactionRow>>`
    SELECT "id", "accountId", "transferToAccountId",
           "recurringTransactionId", "type", "isReconciled", "isCleared",
           "isBalanceAdjustment", "tags", "externalId", "createdByUserId",
           "createdAt"
    FROM "Transaction"
    WHERE "id" = ${input.id} AND "householdId" = ${householdId}`
  if (!existing) return { error: "Transaction not found" }

  if (input.categoryId) {
    const [category] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Category"
      WHERE "id" = ${input.categoryId} AND "householdId" = ${householdId}`
    if (!category) return { error: "Category not found" }
  }

  const amount = Math.abs(input.amount)
  await sql.begin(async (tx) => {
    await tx`DELETE FROM "Transaction" WHERE "id" = ${existing.id}`
    await tx`
      INSERT INTO "Transaction" (
        "id", "householdId", "accountId", "categoryId",
        "transferToAccountId", "recurringTransactionId", "type", "amount",
        "date", "payee", "description", "isReconciled", "isCleared",
        "isBalanceAdjustment", "tags", "externalId", "createdByUserId",
        "createdAt", "updatedAt"
      ) VALUES (
        ${existing.id}, ${householdId}, ${existing.accountId},
        ${input.categoryId}, ${existing.transferToAccountId},
        ${existing.recurringTransactionId}, ${existing.type}, ${amount},
        ${input.date}, ${input.payee}, ${input.description},
        ${existing.isReconciled}, ${existing.isCleared},
        ${existing.isBalanceAdjustment}, ${pgTextArray(existing.tags)}::text[],
        ${existing.externalId}, ${existing.createdByUserId},
        ${existing.createdAt}, now()
      )`
  })
  return { ok: true }
}

export async function deleteTransaction(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  // Scoped lookup first (ADR-0005): a foreign id resolves to nothing and no
  // DELETE runs.
  const [tx] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Transaction"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!tx) return { error: "Transaction not found" }

  // The sync_account_balance DB trigger reverses the balance effect.
  await sql`DELETE FROM "Transaction" WHERE "id" = ${tx.id}`
  return { ok: true }
}
