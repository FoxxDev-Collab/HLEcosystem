// Finance monthly bills (legacy bills/actions.ts + bills page), extended with
// the schema fields the legacy UI never wired up: autopay account picker,
// linked debt, default category, variable amount, notes.
//
// SECURITY (ADR-0005): BillPayment has no householdId — it scopes through its
// parent MonthlyBill. Client-supplied foreign ids (autoPayAccountId,
// linkedDebtId, defaultCategoryId, linked transaction id) are re-verified
// against the household before any write. The legacy markBillPaidAction and
// toggleBillActiveAction skipped the household check entirely; closed here.
import { sql } from "@/server/db"

import type { BillCategory } from "@/lib/finance-constants"

export { BILL_CATEGORIES } from "@/lib/finance-constants"
export type { BillCategory }

export type BillPaymentStatus = "PENDING" | "PAID" | "OVERDUE" | "SCHEDULED"

export type BillRow = {
  id: string
  name: string
  payee: string | null
  category: BillCategory
  expectedAmount: number
  isVariableAmount: boolean
  dueDayOfMonth: number
  autoPay: boolean
  autoPayAccountId: string | null
  autoPayAccountName: string | null
  linkedDebtId: string | null
  linkedDebtName: string | null
  defaultCategoryId: string | null
  defaultCategoryName: string | null
  websiteUrl: string | null
  notes: string | null
  isActive: boolean
  // This month's BillPayment row, if one exists.
  currentPaymentId: string | null
  currentPaymentStatus: BillPaymentStatus | null
  currentPaymentPaidDate: string | null
  currentPaymentAmountPaid: number | null
}

// Bills with their payment row for the month containing `monthStart`
// (a "YYYY-MM-01" date string).
export async function listBills(
  householdId: string,
  monthStart: string
): Promise<Array<BillRow>> {
  return sql<Array<BillRow>>`
    SELECT b."id", b."name", b."payee", b."category",
           b."expectedAmount"::float8, b."isVariableAmount",
           b."dueDayOfMonth", b."autoPay",
           b."autoPayAccountId", a."name" AS "autoPayAccountName",
           b."linkedDebtId", d."name" AS "linkedDebtName",
           b."defaultCategoryId", c."name" AS "defaultCategoryName",
           b."websiteUrl", b."notes", b."isActive",
           p."id" AS "currentPaymentId",
           p."status" AS "currentPaymentStatus",
           p."paidDate"::text AS "currentPaymentPaidDate",
           p."amountPaid"::float8 AS "currentPaymentAmountPaid"
    FROM "MonthlyBill" b
    LEFT JOIN "Account" a ON a."id" = b."autoPayAccountId"
    LEFT JOIN "Debt" d ON d."id" = b."linkedDebtId"
    LEFT JOIN "Category" c ON c."id" = b."defaultCategoryId"
    LEFT JOIN LATERAL (
      SELECT bp."id", bp."status", bp."paidDate", bp."amountPaid"
      FROM "BillPayment" bp
      WHERE bp."monthlyBillId" = b."id"
        AND bp."dueDate" >= ${monthStart}::date
        AND bp."dueDate" < (${monthStart}::date + INTERVAL '1 month')
      ORDER BY bp."createdAt" DESC
      LIMIT 1
    ) p ON true
    WHERE b."householdId" = ${householdId}
    ORDER BY b."isActive" DESC, b."dueDayOfMonth" ASC, b."name" ASC`
}

// Recent EXPENSE transactions (last 90 days) without an existing BillPayment
// link, offered when marking a bill paid.
export type BillLinkableTransactionRow = {
  id: string
  payee: string | null
  description: string | null
  amount: number
  date: string
}

export async function listLinkableTransactionsForBills(
  householdId: string
): Promise<Array<BillLinkableTransactionRow>> {
  return sql<Array<BillLinkableTransactionRow>>`
    SELECT t."id", t."payee", t."description", t."amount"::float8,
           t."date"::text
    FROM "Transaction" t
    WHERE t."householdId" = ${householdId}
      AND t."type" = 'EXPENSE'
      AND t."date" >= CURRENT_DATE - 90
      AND NOT EXISTS (
        SELECT 1 FROM "BillPayment" p WHERE p."linkedTransactionId" = t."id")
    ORDER BY t."date" DESC
    LIMIT 50`
}

export type BillInput = {
  name: string
  payee: string | null
  category: BillCategory
  expectedAmount: number
  isVariableAmount: boolean
  dueDayOfMonth: number
  autoPay: boolean
  autoPayAccountId: string | null
  linkedDebtId: string | null
  defaultCategoryId: string | null
  websiteUrl: string | null
  notes: string | null
}

// Re-verify every client-supplied foreign id against the household
// (ADR-0005) before it is written into a bill row.
async function verifyBillRefs(
  householdId: string,
  input: BillInput
): Promise<{ ok: true } | { error: string }> {
  if (input.autoPayAccountId) {
    const [account] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Account"
      WHERE "id" = ${input.autoPayAccountId} AND "householdId" = ${householdId}`
    if (!account) return { error: "Autopay account not found" }
  }
  if (input.linkedDebtId) {
    const [debt] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Debt"
      WHERE "id" = ${input.linkedDebtId} AND "householdId" = ${householdId}`
    if (!debt) return { error: "Linked debt not found" }
  }
  if (input.defaultCategoryId) {
    const [category] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Category"
      WHERE "id" = ${input.defaultCategoryId}
        AND "householdId" = ${householdId}`
    if (!category) return { error: "Category not found" }
  }
  return { ok: true }
}

export async function createBill(
  householdId: string,
  input: BillInput
): Promise<{ ok: true } | { error: string }> {
  const refs = await verifyBillRefs(householdId, input)
  if ("error" in refs) return refs

  await sql`
    INSERT INTO "MonthlyBill" (
      "householdId", "name", "payee", "category", "expectedAmount",
      "isVariableAmount", "dueDayOfMonth", "autoPay", "autoPayAccountId",
      "linkedDebtId", "defaultCategoryId", "websiteUrl", "notes"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.payee}, ${input.category},
      ${input.expectedAmount}, ${input.isVariableAmount},
      ${input.dueDayOfMonth}, ${input.autoPay}, ${input.autoPayAccountId},
      ${input.linkedDebtId}, ${input.defaultCategoryId}, ${input.websiteUrl},
      ${input.notes}
    )`
  return { ok: true }
}

export async function updateBill(
  householdId: string,
  id: string,
  input: BillInput
): Promise<{ ok: true } | { error: string }> {
  const refs = await verifyBillRefs(householdId, input)
  if ("error" in refs) return refs

  const [row] = await sql<Array<{ id: string }>>`
    UPDATE "MonthlyBill"
    SET "name" = ${input.name}, "payee" = ${input.payee},
        "category" = ${input.category},
        "expectedAmount" = ${input.expectedAmount},
        "isVariableAmount" = ${input.isVariableAmount},
        "dueDayOfMonth" = ${input.dueDayOfMonth},
        "autoPay" = ${input.autoPay},
        "autoPayAccountId" = ${input.autoPayAccountId},
        "linkedDebtId" = ${input.linkedDebtId},
        "defaultCategoryId" = ${input.defaultCategoryId},
        "websiteUrl" = ${input.websiteUrl},
        "notes" = ${input.notes},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (!row) return { error: "Bill not found" }
  return { ok: true }
}

export type MarkBillPaidInput = {
  billId: string
  amountPaid: number
  linkedTransactionId: string | null
  confirmationNumber: string | null
}

// Mark this month's payment as PAID. Updates the existing BillPayment row for
// the month if one exists (re-marking is idempotent), otherwise inserts one
// with dueDate = this month's due day (clamped to month length).
export async function markBillPaid(
  householdId: string,
  input: MarkBillPaidInput
): Promise<{ ok: true } | { error: string }> {
  const [bill] = await sql<
    Array<{ id: string; expectedAmount: number; dueDayOfMonth: number }>
  >`
    SELECT "id", "expectedAmount"::float8, "dueDayOfMonth"
    FROM "MonthlyBill"
    WHERE "id" = ${input.billId} AND "householdId" = ${householdId}`
  if (!bill) return { error: "Bill not found" }

  if (input.linkedTransactionId) {
    const [tx] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Transaction"
      WHERE "id" = ${input.linkedTransactionId}
        AND "householdId" = ${householdId}`
    if (!tx) return { error: "Transaction not found" }
  }

  // This month's payment row, if any (scoped through the verified bill).
  const [existing] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "BillPayment"
    WHERE "monthlyBillId" = ${bill.id}
      AND "dueDate" >= date_trunc('month', CURRENT_DATE)::date
      AND "dueDate" < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
    ORDER BY "createdAt" DESC
    LIMIT 1`

  if (existing) {
    await sql`
      UPDATE "BillPayment"
      SET "status" = 'PAID', "paidDate" = CURRENT_DATE,
          "amountPaid" = ${input.amountPaid},
          "linkedTransactionId" = ${input.linkedTransactionId},
          "confirmationNumber" = ${input.confirmationNumber},
          "updatedAt" = now()
      WHERE "id" = ${existing.id}`
  } else {
    // Due date = this month's due day, clamped to the month's last day.
    await sql`
      INSERT INTO "BillPayment" (
        "monthlyBillId", "dueDate", "paidDate", "amountDue", "amountPaid",
        "status", "linkedTransactionId", "confirmationNumber"
      ) VALUES (
        ${bill.id},
        LEAST(
          date_trunc('month', CURRENT_DATE)::date + (${bill.dueDayOfMonth} - 1),
          (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
        ),
        CURRENT_DATE, ${bill.expectedAmount}, ${input.amountPaid}, 'PAID',
        ${input.linkedTransactionId}, ${input.confirmationNumber}
      )`
  }
  return { ok: true }
}

export async function setBillActive(
  householdId: string,
  id: string,
  isActive: boolean
): Promise<{ ok: true } | { error: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    UPDATE "MonthlyBill"
    SET "isActive" = ${isActive}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (!row) return { error: "Bill not found" }
  return { ok: true }
}

export async function deleteBill(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  // Scoped lookup first (ADR-0005). Payments cascade via FK.
  const [bill] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "MonthlyBill"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!bill) return { error: "Bill not found" }

  await sql`DELETE FROM "MonthlyBill" WHERE "id" = ${bill.id}`
  return { ok: true }
}
