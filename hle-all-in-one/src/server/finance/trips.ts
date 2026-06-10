// Finance trip expense tracker (legacy trips/actions.ts + trips pages).
// Legacy "Trip"/"TripExpense" are "FinanceTrip"/"FinanceTripExpense" in the
// monolith (the travel module owns the plain names).
//
// SECURITY (ADR-0005): FinanceTripExpense has no householdId — every expense
// query scopes through its parent FinanceTrip. Client-supplied foreign ids
// (budgetPlannerProjectId, accountId, categoryId, transactionId) are
// re-verified against the caller's household before use; the legacy app
// trusted accountId blindly, which is exactly the bug class behind the
// 2026-04-08 incident, so this port adds the check.
//
// BALANCES: adding an expense INSERTs a real "Transaction" row; the
// sync_account_balance() DB trigger owns the balance effect. Deleting a
// linked transaction likewise reverses it via the trigger — never update
// Account."currentBalance" here.
import { sql } from "@/server/db"
import { deleteFileFromDisk } from "@/server/file-storage"
import { saveFinanceUpload } from "./taxes"

export type FinanceTripStatus =
  | "PLANNING"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"

export const TRIP_STATUSES: Array<FinanceTripStatus> = [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]

export type FinanceTripExpenseType =
  | "GAS"
  | "FOOD"
  | "LODGING"
  | "TRANSPORT"
  | "SUPPLIES"
  | "OTHER"

export const TRIP_EXPENSE_TYPES: Array<FinanceTripExpenseType> = [
  "GAS",
  "FOOD",
  "LODGING",
  "TRANSPORT",
  "SUPPLIES",
  "OTHER",
]

export const TRIP_EXPENSE_TYPE_LABELS: Record<FinanceTripExpenseType, string> =
  {
    GAS: "Gas",
    FOOD: "Food",
    LODGING: "Lodging",
    TRANSPORT: "Transport",
    SUPPLIES: "Supplies",
    OTHER: "Other",
  }

// Legacy: each expense type auto-maps to a default top-level expense
// category by name when no override is picked.
const EXPENSE_TYPE_CATEGORY_MAP: Record<FinanceTripExpenseType, string> = {
  GAS: "Gas & Fuel",
  FOOD: "Dining Out",
  LODGING: "Travel",
  TRANSPORT: "Travel",
  SUPPLIES: "Shopping",
  OTHER: "Travel",
}

export type TripRow = {
  id: string
  name: string
  description: string | null
  destination: string | null
  startDate: string
  endDate: string
  status: FinanceTripStatus
  isTaxDeductible: boolean
  taxPurpose: string | null
  budgetPlannerProjectId: string | null
  notes: string | null
  totalSpent: number
  expenseCount: number
}

export type TripDetailRow = TripRow & {
  budgetPlannerProjectName: string | null
}

export type TripExpenseRow = {
  id: string
  transactionId: string | null
  expenseType: FinanceTripExpenseType
  date: string
  amount: number
  payee: string | null
  description: string | null
  receiptFileName: string | null
  receiptFileSize: number | null
  receiptUploadedAt: Date | null
}

export type ProjectOption = { id: string; name: string }

export async function listTrips(householdId: string): Promise<Array<TripRow>> {
  return sql<Array<TripRow>>`
    SELECT t."id", t."name", t."description", t."destination",
           t."startDate"::text, t."endDate"::text, t."status",
           t."isTaxDeductible", t."taxPurpose", t."budgetPlannerProjectId",
           t."notes",
           COALESCE(sum(e."amount"), 0)::float8 AS "totalSpent",
           count(e."id")::int AS "expenseCount"
    FROM "FinanceTrip" t
    LEFT JOIN "FinanceTripExpense" e ON e."tripId" = t."id"
    WHERE t."householdId" = ${householdId}
    GROUP BY t."id"
    ORDER BY t."status" ASC, t."startDate" DESC`
}

export async function getTrip(
  householdId: string,
  id: string
): Promise<TripDetailRow | null> {
  const [row] = await sql<Array<TripDetailRow>>`
    SELECT t."id", t."name", t."description", t."destination",
           t."startDate"::text, t."endDate"::text, t."status",
           t."isTaxDeductible", t."taxPurpose", t."budgetPlannerProjectId",
           t."notes", p."name" AS "budgetPlannerProjectName",
           COALESCE(sum(e."amount"), 0)::float8 AS "totalSpent",
           count(e."id")::int AS "expenseCount"
    FROM "FinanceTrip" t
    LEFT JOIN "BudgetPlannerProject" p ON p."id" = t."budgetPlannerProjectId"
    LEFT JOIN "FinanceTripExpense" e ON e."tripId" = t."id"
    WHERE t."id" = ${id} AND t."householdId" = ${householdId}
    GROUP BY t."id", p."name"`
  return row ?? null
}

export async function listTripExpenses(
  householdId: string,
  tripId: string
): Promise<Array<TripExpenseRow>> {
  return sql<Array<TripExpenseRow>>`
    SELECT e."id", e."transactionId", e."expenseType", e."date"::text,
           e."amount"::float8, e."payee", e."description",
           e."receiptFileName", e."receiptFileSize", e."receiptUploadedAt"
    FROM "FinanceTripExpense" e
    JOIN "FinanceTrip" t ON t."id" = e."tripId"
    WHERE e."tripId" = ${tripId} AND t."householdId" = ${householdId}
    ORDER BY e."date" DESC, e."createdAt" DESC`
}

// PLANNING/ACTIVE projects for the "linked project" picker (the table is
// owned by the budget-planner feature; trips only read id + name).
export async function listProjectOptions(
  householdId: string
): Promise<Array<ProjectOption>> {
  return sql<Array<ProjectOption>>`
    SELECT "id", "name"
    FROM "BudgetPlannerProject"
    WHERE "householdId" = ${householdId}
      AND "status" IN ('PLANNING', 'ACTIVE')
    ORDER BY "name" ASC`
}

export type TripInput = {
  name: string
  description: string | null
  destination: string | null
  startDate: string
  endDate: string
  isTaxDeductible: boolean
  taxPurpose: string | null
  budgetPlannerProjectId: string | null
}

// budgetPlannerProjectId is re-scoped via subselect — a cross-household id
// resolves to NULL instead of linking another tenant's project (ADR-0005).
export async function createTrip(
  householdId: string,
  input: TripInput
): Promise<{ id: string }> {
  const taxPurpose = input.isTaxDeductible ? input.taxPurpose : null
  const [row] = await sql<Array<{ id: string }>>`
    INSERT INTO "FinanceTrip" (
      "householdId", "name", "description", "destination", "startDate",
      "endDate", "isTaxDeductible", "taxPurpose", "budgetPlannerProjectId"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.description},
      ${input.destination}, ${input.startDate}, ${input.endDate},
      ${input.isTaxDeductible}, ${taxPurpose},
      (SELECT "id" FROM "BudgetPlannerProject"
       WHERE "id" = ${input.budgetPlannerProjectId}
         AND "householdId" = ${householdId})
    ) RETURNING "id"`
  return row
}

export async function updateTrip(
  householdId: string,
  id: string,
  input: TripInput & { notes: string | null }
): Promise<void> {
  const taxPurpose = input.isTaxDeductible ? input.taxPurpose : null
  await sql`
    UPDATE "FinanceTrip"
    SET "name" = ${input.name}, "description" = ${input.description},
        "destination" = ${input.destination},
        "startDate" = ${input.startDate}, "endDate" = ${input.endDate},
        "isTaxDeductible" = ${input.isTaxDeductible},
        "taxPurpose" = ${taxPurpose},
        "budgetPlannerProjectId" =
          (SELECT "id" FROM "BudgetPlannerProject"
           WHERE "id" = ${input.budgetPlannerProjectId}
             AND "householdId" = ${householdId}),
        "notes" = ${input.notes}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function updateTripStatus(
  householdId: string,
  id: string,
  status: FinanceTripStatus
): Promise<void> {
  await sql`
    UPDATE "FinanceTrip"
    SET "status" = ${status}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

async function deleteReceiptFileIfUnreferenced(
  receiptPath: string
): Promise<void> {
  const [row] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "FinanceTripExpense"
    WHERE "receiptPath" = ${receiptPath}`
  if ((row?.count ?? 0) === 0) {
    await deleteFileFromDisk(receiptPath)
  }
}

// Deletes the trip (expenses cascade via FK; linked transactions stay —
// legacy behavior), then unlinks orphaned receipt files.
export async function deleteTrip(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const paths = await sql<Array<{ receiptPath: string }>>`
    SELECT DISTINCT e."receiptPath"
    FROM "FinanceTripExpense" e
    JOIN "FinanceTrip" t ON t."id" = e."tripId"
    WHERE t."id" = ${id} AND t."householdId" = ${householdId}
      AND e."receiptPath" IS NOT NULL`

  const deleted = await sql<Array<{ id: string }>>`
    DELETE FROM "FinanceTrip"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (deleted.length === 0) return { error: "Trip not found" }

  for (const { receiptPath } of paths) {
    await deleteReceiptFileIfUnreferenced(receiptPath)
  }
  return { ok: true }
}

export type TripExpenseInput = {
  tripId: string
  expenseType: FinanceTripExpenseType
  date: string
  amount: number
  payee: string | null
  description: string | null
  accountId: string
  categoryId: string | null
}

// Creates the real EXPENSE Transaction plus the FinanceTripExpense linking
// to it. Returns the expense id so the client can attach a receipt.
export async function addTripExpense(
  householdId: string,
  userId: string,
  input: TripExpenseInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const [trip] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FinanceTrip"
    WHERE "id" = ${input.tripId} AND "householdId" = ${householdId}`
  if (!trip) return { error: "Trip not found" }

  const [account] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "householdId" = ${householdId}`
  if (!account) return { error: "Account not found" }

  // Category override (re-verified) or auto-map from the expense type.
  let categoryId: string | null = null
  if (input.categoryId) {
    const [category] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Category"
      WHERE "id" = ${input.categoryId} AND "householdId" = ${householdId}`
    categoryId = category?.id ?? null
  }
  if (!categoryId) {
    const [category] = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Category"
      WHERE "householdId" = ${householdId}
        AND "name" = ${EXPENSE_TYPE_CATEGORY_MAP[input.expenseType]}
        AND "parentCategoryId" IS NULL
      LIMIT 1`
    categoryId = category?.id ?? null
  }

  const amount = Math.abs(input.amount)
  let expenseId = ""
  await sql.begin(async (tx) => {
    const [transaction] = await tx<Array<{ id: string }>>`
      INSERT INTO "Transaction" (
        "householdId", "accountId", "categoryId", "type", "amount", "date",
        "payee", "description", "createdByUserId"
      ) VALUES (
        ${householdId}, ${account.id}, ${categoryId}, 'EXPENSE', ${amount},
        ${input.date}, ${input.payee}, ${input.description}, ${userId}
      ) RETURNING "id"`
    const [expense] = await tx<Array<{ id: string }>>`
      INSERT INTO "FinanceTripExpense" (
        "tripId", "transactionId", "expenseType", "date", "amount",
        "payee", "description"
      ) VALUES (
        ${trip.id}, ${transaction.id}, ${input.expenseType}, ${input.date},
        ${amount}, ${input.payee}, ${input.description}
      ) RETURNING "id"`
    expenseId = expense.id
  })
  return { ok: true, id: expenseId }
}

export async function deleteTripExpense(
  householdId: string,
  id: string,
  deleteTransaction: boolean
): Promise<{ ok: true } | { error: string }> {
  const [expense] = await sql<
    Array<{
      id: string
      transactionId: string | null
      receiptPath: string | null
    }>
  >`
    SELECT e."id", e."transactionId", e."receiptPath"
    FROM "FinanceTripExpense" e
    JOIN "FinanceTrip" t ON t."id" = e."tripId"
    WHERE e."id" = ${id} AND t."householdId" = ${householdId}`
  if (!expense) return { error: "Expense not found" }

  await sql`DELETE FROM "FinanceTripExpense" WHERE "id" = ${expense.id}`

  // The balance trigger reverses the account effect on DELETE.
  if (deleteTransaction && expense.transactionId) {
    await sql`
      DELETE FROM "Transaction"
      WHERE "id" = ${expense.transactionId}
        AND "householdId" = ${householdId}`
  }

  if (expense.receiptPath) {
    await deleteReceiptFileIfUnreferenced(expense.receiptPath)
  }
  return { ok: true }
}

// Called from the upload API route after magic-byte validation. Replaces an
// existing receipt (legacy behavior), refcount-deleting the old file.
export async function attachTripExpenseReceipt(
  householdId: string,
  expenseId: string,
  file: { buffer: Uint8Array; originalName: string }
): Promise<{ ok: true } | { error: string }> {
  const [expense] = await sql<
    Array<{ id: string; receiptPath: string | null }>
  >`
    SELECT e."id", e."receiptPath"
    FROM "FinanceTripExpense" e
    JOIN "FinanceTrip" t ON t."id" = e."tripId"
    WHERE e."id" = ${expenseId} AND t."householdId" = ${householdId}`
  if (!expense) return { error: "Expense not found" }

  const { storagePath, contentHash, size } = await saveFinanceUpload(
    householdId,
    "trip-receipts",
    file.buffer,
    file.originalName
  )

  await sql`
    UPDATE "FinanceTripExpense"
    SET "receiptFileName" = ${file.originalName},
        "receiptPath" = ${storagePath}, "receiptFileSize" = ${size},
        "receiptHash" = ${contentHash}, "receiptUploadedAt" = now(),
        "updatedAt" = now()
    WHERE "id" = ${expense.id}`

  if (expense.receiptPath && expense.receiptPath !== storagePath) {
    await deleteReceiptFileIfUnreferenced(expense.receiptPath)
  }
  return { ok: true }
}

export async function removeTripExpenseReceipt(
  householdId: string,
  expenseId: string
): Promise<{ ok: true } | { error: string }> {
  const [expense] = await sql<
    Array<{ id: string; receiptPath: string | null }>
  >`
    SELECT e."id", e."receiptPath"
    FROM "FinanceTripExpense" e
    JOIN "FinanceTrip" t ON t."id" = e."tripId"
    WHERE e."id" = ${expenseId} AND t."householdId" = ${householdId}`
  if (!expense) return { error: "Expense not found" }

  await sql`
    UPDATE "FinanceTripExpense"
    SET "receiptFileName" = NULL, "receiptPath" = NULL,
        "receiptFileSize" = NULL, "receiptHash" = NULL,
        "receiptUploadedAt" = NULL, "updatedAt" = now()
    WHERE "id" = ${expense.id}`

  if (expense.receiptPath) {
    await deleteReceiptFileIfUnreferenced(expense.receiptPath)
  }
  return { ok: true }
}

// File-serving lookup for the receipt API route. Household-scoped through
// the parent FinanceTrip — the scope IS the authorization check.
export async function getTripReceiptForServing(
  householdId: string,
  expenseId: string
): Promise<{ receiptPath: string; receiptFileName: string } | null> {
  const [row] = await sql<
    Array<{ receiptPath: string | null; receiptFileName: string | null }>
  >`
    SELECT e."receiptPath", e."receiptFileName"
    FROM "FinanceTripExpense" e
    JOIN "FinanceTrip" t ON t."id" = e."tripId"
    WHERE e."id" = ${expenseId} AND t."householdId" = ${householdId}`
  if (!row?.receiptPath || !row.receiptFileName) return null
  return { receiptPath: row.receiptPath, receiptFileName: row.receiptFileName }
}
