// Bank statement import (legacy import/actions.ts + import pages).
//
// SECURITY (ADR-0005): the upload's accountId and every batch/row id are
// re-verified against the caller's householdId. ImportedTransaction has no
// householdId of its own — it scopes through its parent ImportBatch.
//
// BALANCES: finalizing a batch INSERTs into "Transaction"; the
// sync_account_balance() DB trigger updates Account.currentBalance — this
// layer never touches balances.
import { sql } from "@/server/db"
import type { ParsedTransaction } from "./import-parser"

export type ImportFileFormat = "CSV" | "QFX" | "OFX"

export type ImportMatchStatus =
  | "PENDING"
  | "AUTO_MATCHED"
  | "IMPORTED"
  | "SKIPPED"
  | "DUPLICATE"

export type ImportBatchRow = {
  id: string
  accountId: string
  accountName: string
  fileName: string
  format: ImportFileFormat
  importedAt: Date
  totalRows: number
  importedCount: number
  duplicateCount: number
  skippedCount: number
  isFinalized: boolean
}

export type ImportedTransactionRow = {
  id: string
  date: string
  amount: number
  description: string | null
  payee: string | null
  checkNumber: string | null
  matchStatus: ImportMatchStatus
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  suggestedCategoryColor: string | null
}

export async function listImportBatches(
  householdId: string
): Promise<Array<ImportBatchRow>> {
  return sql<Array<ImportBatchRow>>`
    SELECT b."id", b."accountId", a."name" AS "accountName", b."fileName",
           b."format", b."importedAt", b."totalRows", b."importedCount",
           b."duplicateCount", b."skippedCount", b."isFinalized"
    FROM "ImportBatch" b
    JOIN "Account" a ON a."id" = b."accountId"
    WHERE b."householdId" = ${householdId}
    ORDER BY b."importedAt" DESC
    LIMIT 20`
}

export async function getImportBatch(
  householdId: string,
  id: string
): Promise<{
  batch: ImportBatchRow
  rows: Array<ImportedTransactionRow>
} | null> {
  const [batch] = await sql<Array<ImportBatchRow>>`
    SELECT b."id", b."accountId", a."name" AS "accountName", b."fileName",
           b."format", b."importedAt", b."totalRows", b."importedCount",
           b."duplicateCount", b."skippedCount", b."isFinalized"
    FROM "ImportBatch" b
    JOIN "Account" a ON a."id" = b."accountId"
    WHERE b."id" = ${id} AND b."householdId" = ${householdId}`
  if (!batch) return null

  const rows = await sql<Array<ImportedTransactionRow>>`
    SELECT t."id", t."date"::text, t."amount"::float8, t."description",
           t."payee", t."checkNumber", t."matchStatus",
           t."suggestedCategoryId", c."name" AS "suggestedCategoryName",
           c."color" AS "suggestedCategoryColor"
    FROM "ImportedTransaction" t
    LEFT JOIN "Category" c ON c."id" = t."suggestedCategoryId"
    WHERE t."importBatchId" = ${batch.id}
    ORDER BY t."date" DESC, t."createdAt" DESC`
  return { batch, rows }
}

type ActiveRule = {
  pattern: string
  matchType: "CONTAINS" | "STARTS_WITH" | "EXACT" | "REGEX"
  categoryId: string
}

// CategoryRule matching, legacy semantics: rules in priority order, first
// match wins; REGEX rules that fail to compile are skipped.
export function matchCategoryRule(
  rules: Array<ActiveRule>,
  description: string
): string | null {
  const target = description.toLowerCase()
  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase()
    let matches = false
    if (rule.matchType === "CONTAINS") matches = target.includes(pattern)
    else if (rule.matchType === "STARTS_WITH")
      matches = target.startsWith(pattern)
    else if (rule.matchType === "EXACT") matches = target === pattern
    else {
      try {
        matches = new RegExp(rule.pattern, "i").test(description)
      } catch {
        // Invalid stored regex — skip the rule (legacy behavior).
      }
    }
    if (matches) return rule.categoryId
  }
  return null
}

export async function listActiveRules(
  householdId: string
): Promise<Array<ActiveRule>> {
  return sql<Array<ActiveRule>>`
    SELECT "pattern", "matchType", "categoryId"
    FROM "CategoryRule"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "priority" DESC, "createdAt" ASC`
}

// Legacy duplicate-detection key: date + signed amount + description, also
// stored as Transaction."externalId" when the row is finalized.
function externalIdFor(tx: {
  date: string
  amount: number
  description: string | null
}): string {
  return `${tx.date}:${tx.amount}:${tx.description ?? ""}`
}

export async function createImportBatch(
  householdId: string,
  userId: string,
  input: {
    accountId: string
    fileName: string
    format: ImportFileFormat
    parsed: Array<ParsedTransaction>
  }
): Promise<{ batchId: string } | { error: string }> {
  // Tenant scoping (ADR-0005): the target account must belong to this
  // household.
  const [account] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "householdId" = ${householdId}`
  if (!account) return { error: "Account not found" }

  if (input.parsed.length === 0) {
    return {
      error:
        "No transactions could be parsed from this file. Verify the format selection matches the file and try again.",
    }
  }

  // Duplicate detection via the externalId pattern on prior imports into the
  // same account (legacy behavior).
  const existing = await sql<Array<{ externalId: string }>>`
    SELECT "externalId" FROM "Transaction"
    WHERE "householdId" = ${householdId}
      AND "accountId" = ${input.accountId}
      AND "externalId" IS NOT NULL`
  const existingExternalIds = new Set(existing.map((t) => t.externalId))

  const rules = await listActiveRules(householdId)

  let duplicateCount = 0
  const [batch] = await sql<Array<{ id: string }>>`
    INSERT INTO "ImportBatch" (
      "householdId", "accountId", "fileName", "format", "importedByUserId",
      "totalRows"
    ) VALUES (
      ${householdId}, ${input.accountId}, ${input.fileName}, ${input.format},
      ${userId}, ${input.parsed.length}
    )
    RETURNING "id"`

  for (const tx of input.parsed) {
    const isDuplicate = existingExternalIds.has(
      externalIdFor({ ...tx, description: tx.description })
    )
    if (isDuplicate) duplicateCount++
    const suggestedCategoryId = matchCategoryRule(rules, tx.description)
    const matchStatus = isDuplicate ? "DUPLICATE" : "PENDING"
    await sql`
      INSERT INTO "ImportedTransaction" (
        "importBatchId", "date", "amount", "description", "payee",
        "checkNumber", "referenceNumber", "rawData", "matchStatus",
        "suggestedCategoryId"
      ) VALUES (
        ${batch.id}, ${tx.date}, ${tx.amount}, ${tx.description},
        ${tx.payee}, ${tx.checkNumber ?? null}, ${tx.referenceNumber ?? null},
        ${tx.rawData}, ${matchStatus}, ${suggestedCategoryId}
      )`
  }

  await sql`
    UPDATE "ImportBatch" SET "duplicateCount" = ${duplicateCount}
    WHERE "id" = ${batch.id}`

  return { batchId: batch.id }
}

export async function skipImportedTransaction(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  // Scope through the parent batch — ImportedTransaction has no householdId.
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "ImportedTransaction" t
    SET "matchStatus" = 'SKIPPED'
    FROM "ImportBatch" b
    WHERE t."id" = ${id}
      AND b."id" = t."importBatchId"
      AND b."householdId" = ${householdId}
      AND b."isFinalized" = false
      AND t."matchStatus" = 'PENDING'
    RETURNING t."id"`
  if (rows.length === 0) return { error: "Row not found" }
  return { ok: true }
}

export async function finalizeImportBatch(
  householdId: string,
  userId: string,
  batchId: string
): Promise<{ ok: true; importedCount: number } | { error: string }> {
  const [batch] = await sql<
    Array<{ id: string; accountId: string; isFinalized: boolean }>
  >`
    SELECT "id", "accountId", "isFinalized" FROM "ImportBatch"
    WHERE "id" = ${batchId} AND "householdId" = ${householdId}`
  if (!batch) return { error: "Import batch not found" }
  if (batch.isFinalized) return { error: "Batch is already finalized" }

  const pending = await sql<
    Array<{
      id: string
      date: string
      amount: number
      description: string | null
      payee: string | null
      suggestedCategoryId: string | null
    }>
  >`
    SELECT "id", "date"::text, "amount"::float8, "description", "payee",
           "suggestedCategoryId"
    FROM "ImportedTransaction"
    WHERE "importBatchId" = ${batch.id} AND "matchStatus" = 'PENDING'
    ORDER BY "date" ASC, "createdAt" ASC`

  let importedCount = 0
  for (const row of pending) {
    // Legacy rule: positive amounts are income, negative are expenses; the
    // transaction stores the absolute value plus the dedupe externalId.
    const type = row.amount >= 0 ? "INCOME" : "EXPENSE"
    const amount = Math.abs(row.amount)
    const externalId = externalIdFor(row)

    const [created] = await sql<Array<{ id: string }>>`
      INSERT INTO "Transaction" (
        "householdId", "accountId", "categoryId", "type", "amount", "date",
        "payee", "description", "externalId", "createdByUserId"
      ) VALUES (
        ${householdId}, ${batch.accountId}, ${row.suggestedCategoryId},
        ${type}, ${amount}, ${row.date}, ${row.payee}, ${row.description},
        ${externalId}, ${userId}
      )
      RETURNING "id"`
    // Account balance is updated by the sync_account_balance DB trigger.

    await sql`
      UPDATE "ImportedTransaction"
      SET "matchStatus" = 'IMPORTED', "createdTransactionId" = ${created.id}
      WHERE "id" = ${row.id}`
    importedCount++
  }

  await sql`
    UPDATE "ImportBatch"
    SET "isFinalized" = true,
        "importedCount" = ${importedCount},
        "skippedCount" = (
          SELECT count(*)::int FROM "ImportedTransaction"
          WHERE "importBatchId" = ${batch.id} AND "matchStatus" = 'SKIPPED'
        )
    WHERE "id" = ${batch.id}`

  return { ok: true, importedCount }
}
