// Finance debts (legacy debts/actions.ts + debts pages).
//
// SECURITY (ADR-0005): every client-supplied foreign id (debt id, payment id,
// linked transaction id) is re-verified against the caller's householdId
// before any mutation. DebtPayment has no householdId of its own — it scopes
// through its parent Debt. The legacy recordDebtPaymentAction skipped the
// household check entirely; that gap is closed here.
//
// Interest rates are stored as decimals (0.065 = 6.5%); the fns layer divides
// form percentages by 100 (legacy behavior).
import { sql } from "@/server/db"

import type { DebtType } from "@/lib/finance-constants"

export { DEBT_TYPES, DEBT_TYPE_LABELS } from "@/lib/finance-constants"
export type { DebtType }

export type DebtRow = {
  id: string
  type: DebtType
  name: string
  lender: string | null
  originalPrincipal: number
  currentBalance: number
  interestRate: number
  termMonths: number | null
  minimumPayment: number | null
  includeInNetWorth: boolean
  notes: string | null
  isArchived: boolean
  refinancedFromId: string | null
  paymentCount: number
  createdAt: Date
}

// Shape consumed by other Agent-B features (bills, assets) for linked-debt
// pickers. Active (non-archived) debts only.
export type DebtPickerRow = {
  id: string
  name: string
  type: DebtType
  currentBalance: number
}

export type DebtPaymentRow = {
  id: string
  paymentDate: string
  totalAmount: number
  principalAmount: number
  interestAmount: number
  escrowAmount: number
  extraPrincipal: number
  remainingBalance: number | null
  linkedTransactionId: string | null
  linkedTransactionPayee: string | null
  linkedTransactionDescription: string | null
  notes: string | null
}

export type LinkedAssetRow = {
  id: string
  name: string
  type: string
  currentValue: number
}

export type LinkedBillRow = {
  id: string
  name: string
}

export type DebtRefRow = {
  id: string
  name: string
}

// Recent unlinked expense transactions offered for payment linking.
export type LinkableTransactionRow = {
  id: string
  payee: string | null
  description: string | null
  amount: number
  date: string
}

export async function listDebts(householdId: string): Promise<Array<DebtRow>> {
  return sql<Array<DebtRow>>`
    SELECT d."id", d."type", d."name", d."lender",
           d."originalPrincipal"::float8, d."currentBalance"::float8,
           d."interestRate"::float8, d."termMonths",
           d."minimumPayment"::float8, d."includeInNetWorth", d."notes",
           d."isArchived", d."refinancedFromId", d."createdAt",
           (SELECT count(*)::int FROM "DebtPayment" p
             WHERE p."debtId" = d."id") AS "paymentCount"
    FROM "Debt" d
    WHERE d."householdId" = ${householdId}
    ORDER BY d."isArchived" ASC, d."currentBalance" DESC`
}

export async function getDebt(
  householdId: string,
  id: string
): Promise<DebtRow | null> {
  const [row] = await sql<Array<DebtRow>>`
    SELECT d."id", d."type", d."name", d."lender",
           d."originalPrincipal"::float8, d."currentBalance"::float8,
           d."interestRate"::float8, d."termMonths",
           d."minimumPayment"::float8, d."includeInNetWorth", d."notes",
           d."isArchived", d."refinancedFromId", d."createdAt",
           (SELECT count(*)::int FROM "DebtPayment" p
             WHERE p."debtId" = d."id") AS "paymentCount"
    FROM "Debt" d
    WHERE d."id" = ${id} AND d."householdId" = ${householdId}`
  return row ?? null
}

export async function listDebtsForPicker(
  householdId: string
): Promise<Array<DebtPickerRow>> {
  return sql<Array<DebtPickerRow>>`
    SELECT "id", "name", "type", "currentBalance"::float8
    FROM "Debt"
    WHERE "householdId" = ${householdId} AND NOT "isArchived"
    ORDER BY "name" ASC`
}

// Payments scope through the parent Debt (child table, no householdId).
export async function listDebtPayments(
  householdId: string,
  debtId: string
): Promise<Array<DebtPaymentRow>> {
  return sql<Array<DebtPaymentRow>>`
    SELECT p."id", p."paymentDate"::text, p."totalAmount"::float8,
           p."principalAmount"::float8, p."interestAmount"::float8,
           p."escrowAmount"::float8, p."extraPrincipal"::float8,
           p."remainingBalance"::float8, p."linkedTransactionId",
           t."payee" AS "linkedTransactionPayee",
           t."description" AS "linkedTransactionDescription",
           p."notes"
    FROM "DebtPayment" p
    JOIN "Debt" d ON d."id" = p."debtId"
    LEFT JOIN "Transaction" t ON t."id" = p."linkedTransactionId"
    WHERE p."debtId" = ${debtId} AND d."householdId" = ${householdId}
    ORDER BY p."paymentDate" DESC, p."createdAt" DESC`
}

export async function listLinkedAssets(
  householdId: string,
  debtId: string
): Promise<Array<LinkedAssetRow>> {
  return sql<Array<LinkedAssetRow>>`
    SELECT "id", "name", "type"::text, "currentValue"::float8
    FROM "Asset"
    WHERE "linkedDebtId" = ${debtId} AND "householdId" = ${householdId}
      AND NOT "isArchived"
    ORDER BY "name" ASC`
}

export async function listLinkedBills(
  householdId: string,
  debtId: string
): Promise<Array<LinkedBillRow>> {
  return sql<Array<LinkedBillRow>>`
    SELECT "id", "name"
    FROM "MonthlyBill"
    WHERE "linkedDebtId" = ${debtId} AND "householdId" = ${householdId}
      AND "isActive"
    ORDER BY "name" ASC`
}

export async function getRefinanceChain(
  householdId: string,
  debt: DebtRow
): Promise<{
  refinancedFrom: DebtRefRow | null
  refinancedTo: DebtRefRow | null
}> {
  let refinancedFrom: DebtRefRow | null = null
  if (debt.refinancedFromId) {
    const [row] = await sql<Array<DebtRefRow>>`
      SELECT "id", "name" FROM "Debt"
      WHERE "id" = ${debt.refinancedFromId} AND "householdId" = ${householdId}`
    refinancedFrom = row ?? null
  }
  const [to] = await sql<Array<DebtRefRow>>`
    SELECT "id", "name" FROM "Debt"
    WHERE "refinancedFromId" = ${debt.id} AND "householdId" = ${householdId}
    LIMIT 1`
  return { refinancedFrom, refinancedTo: to ?? null }
}

// Recent EXPENSE transactions (last 90 days) without an existing DebtPayment
// link, offered as link candidates (legacy debt detail behavior).
export async function listLinkableTransactionsForDebts(
  householdId: string
): Promise<Array<LinkableTransactionRow>> {
  return sql<Array<LinkableTransactionRow>>`
    SELECT t."id", t."payee", t."description", t."amount"::float8,
           t."date"::text
    FROM "Transaction" t
    WHERE t."householdId" = ${householdId}
      AND t."type" = 'EXPENSE'
      AND t."date" >= CURRENT_DATE - 90
      AND NOT EXISTS (
        SELECT 1 FROM "DebtPayment" p WHERE p."linkedTransactionId" = t."id")
    ORDER BY t."date" DESC
    LIMIT 50`
}

export type DebtInput = {
  name: string
  type: DebtType
  lender: string | null
  originalPrincipal: number
  currentBalance: number
  interestRate: number // decimal, e.g. 0.065
  termMonths: number | null
  minimumPayment: number | null
  notes: string | null
}

export async function createDebt(
  householdId: string,
  input: DebtInput
): Promise<{ id: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    INSERT INTO "Debt" (
      "householdId", "name", "type", "lender", "originalPrincipal",
      "currentBalance", "interestRate", "termMonths", "minimumPayment",
      "notes"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.type}, ${input.lender},
      ${input.originalPrincipal}, ${input.currentBalance},
      ${input.interestRate}, ${input.termMonths}, ${input.minimumPayment},
      ${input.notes}
    ) RETURNING "id"`
  return row
}

export async function updateDebt(
  householdId: string,
  id: string,
  input: DebtInput
): Promise<{ ok: true } | { error: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    UPDATE "Debt"
    SET "name" = ${input.name}, "type" = ${input.type},
        "lender" = ${input.lender},
        "originalPrincipal" = ${input.originalPrincipal},
        "currentBalance" = ${input.currentBalance},
        "interestRate" = ${input.interestRate},
        "termMonths" = ${input.termMonths},
        "minimumPayment" = ${input.minimumPayment},
        "notes" = ${input.notes},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (!row) return { error: "Debt not found" }
  return { ok: true }
}

export type RecordDebtPaymentInput = {
  debtId: string
  totalAmount: number
  principalAmount: number
  interestAmount: number
  escrowAmount: number
  extraPrincipal: number
  linkedTransactionId: string | null
  notes: string | null
}

export async function recordDebtPayment(
  householdId: string,
  input: RecordDebtPaymentInput
): Promise<{ ok: true } | { error: string }> {
  // Ownership check (ADR-0005): the debt must belong to this household.
  const [debt] = await sql<Array<{ id: string; currentBalance: number }>>`
    SELECT "id", "currentBalance"::float8 FROM "Debt"
    WHERE "id" = ${input.debtId} AND "householdId" = ${householdId}`
  if (!debt) return { error: "Debt not found" }

  // Re-verify a client-supplied transaction id against the household.
  if (input.linkedTransactionId) {
    const [tx] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Transaction"
      WHERE "id" = ${input.linkedTransactionId}
        AND "householdId" = ${householdId}`
    if (!tx) return { error: "Transaction not found" }
  }

  // Principal and extra principal both reduce the balance.
  const remainingBalance =
    debt.currentBalance - input.principalAmount - input.extraPrincipal

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO "DebtPayment" (
        "debtId", "paymentDate", "totalAmount", "principalAmount",
        "interestAmount", "escrowAmount", "extraPrincipal",
        "remainingBalance", "linkedTransactionId", "notes"
      ) VALUES (
        ${debt.id}, CURRENT_DATE, ${input.totalAmount},
        ${input.principalAmount}, ${input.interestAmount},
        ${input.escrowAmount}, ${input.extraPrincipal},
        ${remainingBalance}, ${input.linkedTransactionId}, ${input.notes}
      )`
    await tx`
      UPDATE "Debt"
      SET "currentBalance" = ${remainingBalance}, "updatedAt" = now()
      WHERE "id" = ${debt.id}`
  })
  return { ok: true }
}

export async function linkDebtPaymentToTransaction(
  householdId: string,
  paymentId: string,
  transactionId: string | null
): Promise<{ ok: true } | { error: string }> {
  // Payment scopes through its parent debt.
  const [payment] = await sql<Array<{ id: string }>>`
    SELECT p."id"
    FROM "DebtPayment" p
    JOIN "Debt" d ON d."id" = p."debtId"
    WHERE p."id" = ${paymentId} AND d."householdId" = ${householdId}`
  if (!payment) return { error: "Payment not found" }

  if (transactionId) {
    const [tx] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Transaction"
      WHERE "id" = ${transactionId} AND "householdId" = ${householdId}`
    if (!tx) return { error: "Transaction not found" }
  }

  await sql`
    UPDATE "DebtPayment"
    SET "linkedTransactionId" = ${transactionId}
    WHERE "id" = ${payment.id}`
  return { ok: true }
}

export type RefinanceDebtInput = {
  oldDebtId: string
  name: string
  type: DebtType
  lender: string | null
  newBalance: number
  interestRate: number // decimal
  termMonths: number | null
  minimumPayment: number | null
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

// Refinance: create the new debt linked via refinancedFromId, transfer linked
// assets/bills/link-patterns, archive the old debt with a note (legacy
// refinanceDebtAction semantics).
export async function refinanceDebt(
  householdId: string,
  input: RefinanceDebtInput
): Promise<{ newDebtId: string } | { error: string }> {
  const [oldDebt] = await sql<
    Array<{
      id: string
      name: string
      currentBalance: number
      paymentDayOfMonth: number | null
      linkedAccountId: string | null
      notes: string | null
    }>
  >`
    SELECT "id", "name", "currentBalance"::float8, "paymentDayOfMonth",
           "linkedAccountId", "notes"
    FROM "Debt"
    WHERE "id" = ${input.oldDebtId} AND "householdId" = ${householdId}`
  if (!oldDebt) return { error: "Debt not found" }

  const newNotes = `Refinanced from "${oldDebt.name}" (balance was ${formatUsd(oldDebt.currentBalance)})`
  const archiveNote = `Refinanced to "${input.name}" on ${new Date().toLocaleDateString("en-US")}`
  const oldNotes = oldDebt.notes
    ? `${oldDebt.notes}\n\n${archiveNote}`
    : archiveNote

  const newDebtId = await sql.begin(async (tx) => {
    const [newDebt] = await tx<Array<{ id: string }>>`
      INSERT INTO "Debt" (
        "householdId", "name", "type", "lender", "originalPrincipal",
        "currentBalance", "interestRate", "termMonths", "minimumPayment",
        "paymentDayOfMonth", "linkedAccountId", "refinancedFromId", "notes"
      ) VALUES (
        ${householdId}, ${input.name}, ${input.type}, ${input.lender},
        ${input.newBalance}, ${input.newBalance}, ${input.interestRate},
        ${input.termMonths}, ${input.minimumPayment},
        ${oldDebt.paymentDayOfMonth}, ${oldDebt.linkedAccountId},
        ${oldDebt.id}, ${newNotes}
      ) RETURNING "id"`

    // Transfer linked assets, bills, and learned link patterns (all scoped).
    await tx`
      UPDATE "Asset"
      SET "linkedDebtId" = ${newDebt.id}, "updatedAt" = now()
      WHERE "linkedDebtId" = ${oldDebt.id} AND "householdId" = ${householdId}`
    await tx`
      UPDATE "MonthlyBill"
      SET "linkedDebtId" = ${newDebt.id}, "updatedAt" = now()
      WHERE "linkedDebtId" = ${oldDebt.id} AND "householdId" = ${householdId}`
    await tx`
      UPDATE "TransactionLinkPattern"
      SET "matchId" = ${newDebt.id}, "matchName" = ${input.name},
          "updatedAt" = now()
      WHERE "householdId" = ${householdId}
        AND "matchType" = 'debt' AND "matchId" = ${oldDebt.id}`

    await tx`
      UPDATE "Debt"
      SET "isArchived" = true, "notes" = ${oldNotes}, "updatedAt" = now()
      WHERE "id" = ${oldDebt.id}`

    return newDebt.id
  })
  return { newDebtId }
}

export async function setDebtArchived(
  householdId: string,
  id: string,
  isArchived: boolean
): Promise<{ ok: true } | { error: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    UPDATE "Debt"
    SET "isArchived" = ${isArchived}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (!row) return { error: "Debt not found" }
  return { ok: true }
}

export async function deleteDebt(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  // Scoped lookup first (ADR-0005). Payments cascade via FK.
  const [debt] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Debt"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!debt) return { error: "Debt not found" }

  await sql`DELETE FROM "Debt" WHERE "id" = ${debt.id}`
  return { ok: true }
}
