// Medical expenses port from hle-family_health /expenses. Rows scope through
// "HealthMember"."householdId". paidFromHsa / insuranceReimbursement are kept
// as data fields and feed the year summary totals.
//
// The optional "Sync to Family Finance" hand-off from the legacy app is
// wired up in fns.expenses.ts via the in-process finance module (the legacy
// cross-schema lib/finance-bridge.ts is obsolete — the balance is now owned
// by the sync_account_balance trigger, so only the INSERT happens here).
import { sql } from "@/server/db"

export type ExpenseCategory =
  | "MEDICAL_EQUIPMENT"
  | "VISION"
  | "DENTAL"
  | "SUPPLIES"
  | "OVER_THE_COUNTER"
  | "PRESCRIPTION"
  | "COPAY"
  | "LAB_WORK"
  | "THERAPY"
  | "OTHER"

export type MedicalExpenseRow = {
  id: string
  memberId: string
  memberFirstName: string
  memberLastName: string
  description: string
  category: ExpenseCategory
  amount: number
  expenseDate: string
  paidFromHsa: boolean
  insuranceReimbursement: number | null
  notes: string | null
}

export type MedicalExpenseInput = {
  description: string
  category: ExpenseCategory
  amount: number
  expenseDate: string
  paidFromHsa: boolean
  insuranceReimbursement: number | null
  notes: string | null
}

export async function listMedicalExpenses(
  householdId: string
): Promise<Array<MedicalExpenseRow>> {
  return sql<Array<MedicalExpenseRow>>`
    SELECT e."id", e."memberId",
           hm."firstName" AS "memberFirstName",
           hm."lastName" AS "memberLastName",
           e."description", e."category", e."amount"::float8,
           e."expenseDate"::text, e."paidFromHsa",
           e."insuranceReimbursement"::float8, e."notes"
    FROM "MedicalExpense" e
    JOIN "HealthMember" hm ON hm."id" = e."memberId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY e."expenseDate" DESC`
}

export async function createMedicalExpense(
  memberId: string,
  input: MedicalExpenseInput
): Promise<void> {
  // Caller must verify memberId ownership via healthMemberBelongsToHousehold.
  await sql`
    INSERT INTO "MedicalExpense" (
      "memberId", "description", "category", "amount", "expenseDate",
      "paidFromHsa", "insuranceReimbursement", "notes"
    ) VALUES (
      ${memberId}, ${input.description}, ${input.category}::"ExpenseCategory",
      ${input.amount}, ${input.expenseDate}, ${input.paidFromHsa},
      ${input.insuranceReimbursement}, ${input.notes}
    )`
}

// Name lookup for the finance hand-off's transaction description. Scoped —
// returns null for members outside the household.
export async function getHealthMemberName(
  householdId: string,
  memberId: string
): Promise<string | null> {
  const rows = await sql<Array<{ firstName: string; lastName: string }>>`
    SELECT "firstName", "lastName" FROM "HealthMember"
    WHERE "id" = ${memberId} AND "householdId" = ${householdId}`
  const row = rows[0]
  return row ? `${row.firstName} ${row.lastName}` : null
}

export async function deleteMedicalExpense(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "MedicalExpense" e
    USING "HealthMember" hm
    WHERE e."id" = ${id} AND hm."id" = e."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING e."id"`
  return rows.length > 0
}
