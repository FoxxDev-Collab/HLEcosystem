// Finance accounts (legacy accounts/actions.ts + accounts pages).
// Account."currentBalance" is owned by the sync_account_balance() DB trigger
// on Transaction INSERT/DELETE — this layer NEVER updates it directly. The
// "adjust balance" flow inserts an isBalanceAdjustment transaction, which
// also goes through the trigger. Account deletion is an explicit cascade
// (legacy deleteAccountAction ordering) because Transaction."accountId"
// deliberately has no ON DELETE action.
import { sql } from "@/server/db"

export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "CASH"
  | "INVESTMENT"
  | "LOAN"
  | "HSA"
  | "OTHER"

export const ACCOUNT_TYPES: Array<AccountType> = [
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
  "CASH",
  "INVESTMENT",
  "LOAN",
  "HSA",
  "OTHER",
]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit Card",
  CASH: "Cash",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  HSA: "HSA",
  OTHER: "Other",
}

export type AccountRow = {
  id: string
  name: string
  type: AccountType
  institution: string | null
  initialBalance: number
  currentBalance: number
  creditLimit: number | null
  interestRate: number | null
  hsaAnnualLimit: number | null
  hsaFamilyCoverage: boolean
  color: string | null
  notes: string | null
  isArchived: boolean
  includeInNetWorth: boolean
  transactionCount: number
  createdAt: Date
}

// Shape consumed by other finance features (transactions, recurring, bills,
// debts, import). Active = not archived.
export type AccountPickerRow = {
  id: string
  name: string
  type: AccountType
  currentBalance: number
}

export async function listAccounts(
  householdId: string
): Promise<Array<AccountRow>> {
  return sql<Array<AccountRow>>`
    SELECT a."id", a."name", a."type", a."institution",
           a."initialBalance"::float8, a."currentBalance"::float8,
           a."creditLimit"::float8, a."interestRate"::float8,
           a."hsaAnnualLimit"::float8, a."hsaFamilyCoverage",
           a."color", a."notes", a."isArchived", a."includeInNetWorth",
           a."createdAt",
           (SELECT count(*)::int FROM "Transaction" t
             WHERE t."accountId" = a."id") AS "transactionCount"
    FROM "Account" a
    WHERE a."householdId" = ${householdId}
    ORDER BY a."isArchived" ASC, a."sortOrder" ASC, a."name" ASC`
}

export async function getAccount(
  householdId: string,
  id: string
): Promise<AccountRow | null> {
  const [row] = await sql<Array<AccountRow>>`
    SELECT a."id", a."name", a."type", a."institution",
           a."initialBalance"::float8, a."currentBalance"::float8,
           a."creditLimit"::float8, a."interestRate"::float8,
           a."hsaAnnualLimit"::float8, a."hsaFamilyCoverage",
           a."color", a."notes", a."isArchived", a."includeInNetWorth",
           a."createdAt",
           (SELECT count(*)::int FROM "Transaction" t
             WHERE t."accountId" = a."id") AS "transactionCount"
    FROM "Account" a
    WHERE a."id" = ${id} AND a."householdId" = ${householdId}`
  return row ?? null
}

// Picker used by transactions/recurring here and by agents B/C/D (bills,
// debts, import, trips). Active (non-archived) accounts only.
export async function listAccountsForPicker(
  householdId: string
): Promise<Array<AccountPickerRow>> {
  return sql<Array<AccountPickerRow>>`
    SELECT "id", "name", "type", "currentBalance"::float8
    FROM "Account"
    WHERE "householdId" = ${householdId} AND NOT "isArchived"
    ORDER BY "name" ASC`
}

export type AccountInput = {
  name: string
  type: AccountType
  institution: string | null
  creditLimit: number | null
  interestRate: number | null
  hsaAnnualLimit: number | null
  hsaFamilyCoverage: boolean
  color: string
  notes: string | null
}

export async function createAccount(
  householdId: string,
  input: AccountInput & { initialBalance: number }
): Promise<{ id: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    INSERT INTO "Account" (
      "householdId", "name", "type", "institution", "initialBalance",
      "currentBalance", "creditLimit", "interestRate", "hsaAnnualLimit",
      "hsaFamilyCoverage", "color", "notes"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.type}, ${input.institution},
      ${input.initialBalance}, ${input.initialBalance}, ${input.creditLimit},
      ${input.interestRate}, ${input.hsaAnnualLimit},
      ${input.hsaFamilyCoverage}, ${input.color}, ${input.notes}
    ) RETURNING "id"`
  return row
}

export async function updateAccount(
  householdId: string,
  id: string,
  input: AccountInput
): Promise<void> {
  await sql`
    UPDATE "Account"
    SET "name" = ${input.name}, "type" = ${input.type},
        "institution" = ${input.institution},
        "creditLimit" = ${input.creditLimit},
        "interestRate" = ${input.interestRate},
        "hsaAnnualLimit" = ${input.hsaAnnualLimit},
        "hsaFamilyCoverage" = ${input.hsaFamilyCoverage},
        "color" = ${input.color}, "notes" = ${input.notes},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function setAccountArchived(
  householdId: string,
  id: string,
  isArchived: boolean
): Promise<void> {
  await sql`
    UPDATE "Account"
    SET "isArchived" = ${isArchived}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}

// Legacy adjustBalanceAction: insert an isBalanceAdjustment INCOME/EXPENSE
// transaction for the difference; the balance trigger applies it. No direct
// balance write here.
export async function adjustBalance(
  householdId: string,
  userId: string,
  accountId: string,
  targetBalance: number
): Promise<{ ok: true } | { error: string }> {
  const [account] = await sql<Array<{ id: string; currentBalance: number }>>`
    SELECT "id", "currentBalance"::float8
    FROM "Account"
    WHERE "id" = ${accountId} AND "householdId" = ${householdId}`
  if (!account) return { error: "Account not found" }

  const difference = targetBalance - account.currentBalance
  if (difference === 0) return { ok: true }

  // Find or create the "Balance Adjustment" category (TRANSFER type,
  // excluded from reports via isBalanceAdjustment on the transaction).
  let [category] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Category"
    WHERE "householdId" = ${householdId} AND "name" = 'Balance Adjustment'
    LIMIT 1`
  if (!category) {
    const created = await sql<Array<{ id: string }>>`
      INSERT INTO "Category" ("householdId", "name", "type", "icon", "color")
      VALUES (${householdId}, 'Balance Adjustment', 'TRANSFER', 'scale', '#6b7280')
      RETURNING "id"`
    category = created[0]
  }

  const type = difference > 0 ? "INCOME" : "EXPENSE"
  const description = `Adjusted from ${formatUsd(account.currentBalance)} to ${formatUsd(targetBalance)}`
  await sql`
    INSERT INTO "Transaction" (
      "householdId", "accountId", "categoryId", "type", "amount", "date",
      "payee", "description", "isBalanceAdjustment", "createdByUserId"
    ) VALUES (
      ${householdId}, ${accountId}, ${category.id}, ${type},
      ${Math.abs(difference)}, CURRENT_DATE, 'Balance Adjustment',
      ${description}, true, ${userId}
    )`
  return { ok: true }
}

// Explicit cascade in legacy deleteAccountAction order:
// 1. ImportedTransactions -> ImportBatches for this account
// 2. BillPayments linked to transactions on this account
// 3. DebtPayments linked to transactions on this account
// 4. Recurring transactions for this account
// 5. Transactions (both accountId and transferToAccountId legs)
// 6. The account itself
// Each Transaction DELETE fires the balance trigger, which correctly
// reverses the mirrored effect on *other* accounts for transfer rows.
export async function deleteAccountCascade(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const [account] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!account) return { error: "Account not found" }

  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM "ImportedTransaction"
      WHERE "importBatchId" IN (
        SELECT "id" FROM "ImportBatch" WHERE "accountId" = ${id})`
    await tx`DELETE FROM "ImportBatch" WHERE "accountId" = ${id}`
    await tx`
      DELETE FROM "BillPayment"
      WHERE "linkedTransactionId" IN (
        SELECT "id" FROM "Transaction" WHERE "accountId" = ${id})`
    await tx`
      DELETE FROM "DebtPayment"
      WHERE "linkedTransactionId" IN (
        SELECT "id" FROM "Transaction" WHERE "accountId" = ${id})`
    await tx`DELETE FROM "RecurringTransaction" WHERE "accountId" = ${id}`
    await tx`
      DELETE FROM "Transaction"
      WHERE "accountId" = ${id} OR "transferToAccountId" = ${id}`
    await tx`DELETE FROM "Account" WHERE "id" = ${id}`
  })
  return { ok: true }
}
