// Recurring transactions (legacy recurring/actions.ts + page.tsx).
// "Process due now" calls the process_due_recurring() PG function, which
// creates due transactions (each INSERT fires the balance trigger), advances
// nextOccurrence, and deactivates rules past their end date — atomically.
import { sql } from "@/server/db"
import type { TransactionType } from "./transactions"

import type { RecurrenceFrequency } from "@/lib/finance-constants"

export { RECURRENCE_FREQUENCIES } from "@/lib/finance-constants"
export type { RecurrenceFrequency }

export type RecurringRow = {
  id: string
  name: string
  type: TransactionType
  amount: number
  payee: string | null
  frequency: RecurrenceFrequency
  frequencyInterval: number
  dayOfPeriod: number | null
  startDate: string
  endDate: string | null
  nextOccurrence: string | null
  lastProcessed: string | null
  isActive: boolean
  autoCreate: boolean
  accountId: string
  accountName: string
  categoryId: string | null
  categoryName: string | null
  transferToAccountId: string | null
  transferToAccountName: string | null
}

export async function listRecurring(
  householdId: string
): Promise<Array<RecurringRow>> {
  return sql<Array<RecurringRow>>`
    SELECT r."id", r."name", r."type", r."amount"::float8, r."payee",
           r."frequency", r."frequencyInterval", r."dayOfPeriod",
           r."startDate"::text, r."endDate"::text, r."nextOccurrence"::text,
           r."lastProcessed"::text, r."isActive", r."autoCreate",
           r."accountId", a."name" AS "accountName",
           r."categoryId", c."name" AS "categoryName",
           r."transferToAccountId", ta."name" AS "transferToAccountName"
    FROM "RecurringTransaction" r
    JOIN "Account" a ON a."id" = r."accountId"
    LEFT JOIN "Category" c ON c."id" = r."categoryId"
    LEFT JOIN "Account" ta ON ta."id" = r."transferToAccountId"
    WHERE r."householdId" = ${householdId}
    ORDER BY r."isActive" DESC, r."nextOccurrence" ASC NULLS LAST
    LIMIT 100`
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

// Same advancement rules as the legacy TS helper and the PG function.
export function calculateNextOccurrence(
  current: string,
  frequency: RecurrenceFrequency,
  interval: number,
  dayOfPeriod: number | null
): string {
  const next = parseIsoDate(current)
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + interval)
      break
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * interval)
      break
    case "BI_WEEKLY":
      next.setDate(next.getDate() + 14)
      break
    case "MONTHLY":
      next.setMonth(next.getMonth() + interval)
      if (dayOfPeriod) next.setDate(Math.min(dayOfPeriod, daysInMonth(next)))
      break
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3)
      if (dayOfPeriod) next.setDate(Math.min(dayOfPeriod, daysInMonth(next)))
      break
    case "YEARLY":
      next.setFullYear(next.getFullYear() + interval)
      break
  }
  return toIsoDate(next)
}

export type RecurringInput = {
  name: string
  type: TransactionType
  accountId: string
  categoryId: string | null
  transferToAccountId: string | null
  amount: number
  payee: string | null
  frequency: RecurrenceFrequency
  dayOfPeriod: number | null
  startDate: string
  autoCreate: boolean
}

export async function createRecurring(
  householdId: string,
  input: RecurringInput
): Promise<{ ok: true } | { error: string }> {
  // Re-verify every client-supplied foreign id (ADR-0005).
  const [account] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "householdId" = ${householdId}`
  if (!account) return { error: "Account not found" }

  const transferToAccountId =
    input.type === "TRANSFER" ? input.transferToAccountId : null
  if (transferToAccountId) {
    const [dest] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Account"
      WHERE "id" = ${transferToAccountId} AND "householdId" = ${householdId}`
    if (!dest) return { error: "Destination account not found" }
  }
  if (input.categoryId) {
    const [category] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Category"
      WHERE "id" = ${input.categoryId} AND "householdId" = ${householdId}`
    if (!category) return { error: "Category not found" }
  }

  // Legacy rule: a future start date IS the first occurrence; a past start
  // date advances one period from the start.
  const today = toIsoDate(new Date())
  const nextOccurrence =
    input.startDate > today
      ? input.startDate
      : calculateNextOccurrence(
          input.startDate,
          input.frequency,
          1,
          input.dayOfPeriod
        )

  await sql`
    INSERT INTO "RecurringTransaction" (
      "householdId", "name", "type", "accountId", "categoryId",
      "transferToAccountId", "amount", "payee", "frequency", "dayOfPeriod",
      "startDate", "nextOccurrence", "autoCreate"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.type}, ${input.accountId},
      ${input.categoryId}, ${transferToAccountId},
      ${Math.abs(input.amount)}, ${input.payee}, ${input.frequency},
      ${input.dayOfPeriod}, ${input.startDate}, ${nextOccurrence},
      ${input.autoCreate}
    )`
  return { ok: true }
}

export async function toggleRecurringActive(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    UPDATE "RecurringTransaction"
    SET "isActive" = NOT "isActive", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function skipNextOccurrence(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const [recurring] = await sql<
    Array<{
      id: string
      frequency: RecurrenceFrequency
      frequencyInterval: number
      dayOfPeriod: number | null
      nextOccurrence: string | null
      endDate: string | null
    }>
  >`
    SELECT "id", "frequency", "frequencyInterval", "dayOfPeriod",
           "nextOccurrence"::text, "endDate"::text
    FROM "RecurringTransaction"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!recurring || !recurring.nextOccurrence) {
    return { error: "Recurring transaction not found" }
  }

  const nextOccurrence = calculateNextOccurrence(
    recurring.nextOccurrence,
    recurring.frequency,
    recurring.frequencyInterval,
    recurring.dayOfPeriod
  )

  // Don't go past the end date — deactivate instead (legacy rule).
  if (recurring.endDate && nextOccurrence > recurring.endDate) {
    await sql`
      UPDATE "RecurringTransaction"
      SET "isActive" = false, "nextOccurrence" = NULL, "updatedAt" = now()
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  } else {
    await sql`
      UPDATE "RecurringTransaction"
      SET "nextOccurrence" = ${nextOccurrence}, "updatedAt" = now()
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  }
  return { ok: true }
}

export async function deleteRecurring(
  householdId: string,
  id: string
): Promise<void> {
  // Transaction."recurringTransactionId" is ON DELETE SET NULL — history of
  // already-created transactions is preserved.
  await sql`
    DELETE FROM "RecurringTransaction"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function processDueRecurring(
  householdId: string,
  userId: string
): Promise<number> {
  const [row] = await sql<Array<{ count: number }>>`
    SELECT process_due_recurring(${householdId}, ${userId})::int AS "count"`
  return row.count
}
