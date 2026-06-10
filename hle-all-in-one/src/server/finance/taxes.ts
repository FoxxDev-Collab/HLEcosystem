// Finance tax tracking (legacy taxes/actions.ts + taxes pages).
// TaxDocument has no householdId — every document query scopes through its
// parent TaxYear (ADR-0005). Uploaded files are content-addressed under
// <UPLOAD_DIR>/<householdId>/tax-documents/ and refcounted by "storagePath"
// before unlinking (same scheme as src/server/file-storage.ts — paths embed
// the householdId, so counting rows on the path is safe).
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, extname, join } from "node:path"
import { sql } from "@/server/db"
import {
  computeContentHash,
  deleteFileFromDisk,
  fileExistsOnDisk,
} from "@/server/file-storage"

// ---------------------------------------------------------------------------
// Shared upload helpers (also used by trips.ts for expense receipts)
// ---------------------------------------------------------------------------

// Legacy allowlist: tax documents and trip receipts are PDFs or photos.
export const FINANCE_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".heic",
])

const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
}

// TaxDocument / FinanceTripExpense store no mimeType column (legacy schema);
// the serve/download routes derive Content-Type from the stored filename.
export function mimeFromFilename(name: string): string {
  return (
    EXTENSION_MIME[extname(name).toLowerCase()] ?? "application/octet-stream"
  )
}

// Content-addressed save like file-storage's saveFile, but namespaced per
// finance feature: <UPLOAD_DIR>/<householdId>/<subdir>/<hash[0:2]>/<hash><ext>
export async function saveFinanceUpload(
  householdId: string,
  subdir: "tax-documents" | "trip-receipts",
  buffer: Uint8Array,
  originalName: string
): Promise<{ storagePath: string; contentHash: string; size: number }> {
  const contentHash = computeContentHash(buffer)
  const ext = extname(originalName).toLowerCase() || ".bin"
  const storagePath = join(
    process.env.UPLOAD_DIR || "./uploads",
    householdId,
    subdir,
    contentHash.substring(0, 2),
    `${contentHash}${ext}`
  )
  if (!(await fileExistsOnDisk(storagePath))) {
    await mkdir(dirname(storagePath), { recursive: true })
    await writeFile(storagePath, buffer)
  }
  return { storagePath, contentHash, size: buffer.length }
}

async function deleteTaxFileIfUnreferenced(storagePath: string): Promise<void> {
  const [row] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "TaxDocument"
    WHERE "storagePath" = ${storagePath}`
  if ((row?.count ?? 0) === 0) {
    await deleteFileFromDisk(storagePath)
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaxFilingStatus =
  | "SINGLE"
  | "MARRIED_FILING_JOINTLY"
  | "MARRIED_FILING_SEPARATELY"
  | "HEAD_OF_HOUSEHOLD"
  | "QUALIFYING_WIDOWER"

export const FILING_STATUSES: Array<TaxFilingStatus> = [
  "SINGLE",
  "MARRIED_FILING_JOINTLY",
  "MARRIED_FILING_SEPARATELY",
  "HEAD_OF_HOUSEHOLD",
  "QUALIFYING_WIDOWER",
]

export const FILING_STATUS_LABELS: Record<TaxFilingStatus, string> = {
  SINGLE: "Single",
  MARRIED_FILING_JOINTLY: "Married Filing Jointly",
  MARRIED_FILING_SEPARATELY: "Married Filing Separately",
  HEAD_OF_HOUSEHOLD: "Head of Household",
  QUALIFYING_WIDOWER: "Qualifying Widower",
}

export type TaxDocumentType =
  | "W2"
  | "FORM_1099_INT"
  | "FORM_1099_DIV"
  | "FORM_1099_NEC"
  | "FORM_1098"
  | "FORM_1099_B"
  | "FORM_1099_R"
  | "K1"
  | "FORM_1099_SA"
  | "FORM_5498_SA"
  | "OTHER"

export const TAX_DOCUMENT_TYPES: Array<TaxDocumentType> = [
  "W2",
  "FORM_1099_INT",
  "FORM_1099_DIV",
  "FORM_1099_NEC",
  "FORM_1098",
  "FORM_1099_B",
  "FORM_1099_R",
  "K1",
  "FORM_1099_SA",
  "FORM_5498_SA",
  "OTHER",
]

export const TAX_DOCUMENT_TYPE_LABELS: Record<TaxDocumentType, string> = {
  W2: "W-2",
  FORM_1099_INT: "1099-INT",
  FORM_1099_DIV: "1099-DIV",
  FORM_1099_NEC: "1099-NEC",
  FORM_1098: "1098",
  FORM_1099_B: "1099-B",
  FORM_1099_R: "1099-R",
  K1: "K-1",
  FORM_1099_SA: "1099-SA",
  FORM_5498_SA: "5498-SA",
  OTHER: "Other",
}

export type TaxYearRow = {
  id: string
  year: number
  federalFilingStatus: TaxFilingStatus | null
  state: string | null
  isFederalFiled: boolean
  federalFiledDate: string | null
  isStateFiled: boolean
  stateFiledDate: string | null
  federalRefund: number | null
  stateRefund: number | null
  federalOwed: number | null
  stateOwed: number | null
  refundReceived: boolean
  refundReceivedDate: string | null
  federalOwedPaid: boolean
  stateOwedPaid: boolean
  notes: string | null
  totalGross: number
  totalFederalWithheld: number
  totalStateWithheld: number
  totalSocialSecurityWithheld: number
  totalMedicareWithheld: number
  documentCount: number
  receivedCount: number
}

export type TaxDocumentRow = {
  id: string
  documentType: TaxDocumentType
  issuer: string
  description: string | null
  grossAmount: number | null
  federalWithheld: number | null
  stateWithheld: number | null
  socialSecurityWithheld: number | null
  medicareWithheld: number | null
  isReceived: boolean
  receivedDate: string | null
  expectedDate: string | null
  notes: string | null
  uploadedFileName: string | null
  fileSize: number | null
  uploadedAt: Date | null
}

// ---------------------------------------------------------------------------
// Tax years
// ---------------------------------------------------------------------------

export async function listTaxYears(
  householdId: string
): Promise<Array<TaxYearRow>> {
  return sql<Array<TaxYearRow>>`
    SELECT ty."id", ty."year", ty."federalFilingStatus", ty."state",
           ty."isFederalFiled", ty."federalFiledDate"::text,
           ty."isStateFiled", ty."stateFiledDate"::text,
           ty."federalRefund"::float8, ty."stateRefund"::float8,
           ty."federalOwed"::float8, ty."stateOwed"::float8,
           ty."refundReceived", ty."refundReceivedDate"::text,
           ty."federalOwedPaid", ty."stateOwedPaid", ty."notes",
           COALESCE(sum(d."grossAmount"), 0)::float8 AS "totalGross",
           COALESCE(sum(d."federalWithheld"), 0)::float8 AS "totalFederalWithheld",
           COALESCE(sum(d."stateWithheld"), 0)::float8 AS "totalStateWithheld",
           COALESCE(sum(d."socialSecurityWithheld"), 0)::float8 AS "totalSocialSecurityWithheld",
           COALESCE(sum(d."medicareWithheld"), 0)::float8 AS "totalMedicareWithheld",
           count(d."id")::int AS "documentCount",
           (count(d."id") FILTER (WHERE d."isReceived"))::int AS "receivedCount"
    FROM "TaxYear" ty
    LEFT JOIN "TaxDocument" d ON d."taxYearId" = ty."id"
    WHERE ty."householdId" = ${householdId}
    GROUP BY ty."id"
    ORDER BY ty."year" DESC`
}

export async function getTaxYear(
  householdId: string,
  id: string
): Promise<TaxYearRow | null> {
  const [row] = await sql<Array<TaxYearRow>>`
    SELECT ty."id", ty."year", ty."federalFilingStatus", ty."state",
           ty."isFederalFiled", ty."federalFiledDate"::text,
           ty."isStateFiled", ty."stateFiledDate"::text,
           ty."federalRefund"::float8, ty."stateRefund"::float8,
           ty."federalOwed"::float8, ty."stateOwed"::float8,
           ty."refundReceived", ty."refundReceivedDate"::text,
           ty."federalOwedPaid", ty."stateOwedPaid", ty."notes",
           COALESCE(sum(d."grossAmount"), 0)::float8 AS "totalGross",
           COALESCE(sum(d."federalWithheld"), 0)::float8 AS "totalFederalWithheld",
           COALESCE(sum(d."stateWithheld"), 0)::float8 AS "totalStateWithheld",
           COALESCE(sum(d."socialSecurityWithheld"), 0)::float8 AS "totalSocialSecurityWithheld",
           COALESCE(sum(d."medicareWithheld"), 0)::float8 AS "totalMedicareWithheld",
           count(d."id")::int AS "documentCount",
           (count(d."id") FILTER (WHERE d."isReceived"))::int AS "receivedCount"
    FROM "TaxYear" ty
    LEFT JOIN "TaxDocument" d ON d."taxYearId" = ty."id"
    WHERE ty."id" = ${id} AND ty."householdId" = ${householdId}
    GROUP BY ty."id"`
  return row ?? null
}

export async function createTaxYear(
  householdId: string,
  input: {
    year: number
    federalFilingStatus: TaxFilingStatus | null
    state: string | null
  }
): Promise<{ ok: true; id: string } | { error: string }> {
  const [existing] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "TaxYear"
    WHERE "householdId" = ${householdId} AND "year" = ${input.year}`
  if (existing) return { error: `Tax year ${input.year} already exists` }

  const [row] = await sql<Array<{ id: string }>>`
    INSERT INTO "TaxYear" ("householdId", "year", "federalFilingStatus", "state")
    VALUES (${householdId}, ${input.year}, ${input.federalFilingStatus}, ${input.state})
    RETURNING "id"`
  return { ok: true, id: row.id }
}

export async function updateTaxYearDetails(
  householdId: string,
  id: string,
  input: {
    federalFilingStatus: TaxFilingStatus | null
    state: string | null
    notes: string | null
  }
): Promise<void> {
  await sql`
    UPDATE "TaxYear"
    SET "federalFilingStatus" = ${input.federalFilingStatus},
        "state" = ${input.state}, "notes" = ${input.notes},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function updateTaxRefund(
  householdId: string,
  id: string,
  input: {
    federalRefund: number | null
    stateRefund: number | null
    federalOwed: number | null
    stateOwed: number | null
  }
): Promise<void> {
  await sql`
    UPDATE "TaxYear"
    SET "federalRefund" = ${input.federalRefund},
        "stateRefund" = ${input.stateRefund},
        "federalOwed" = ${input.federalOwed},
        "stateOwed" = ${input.stateOwed},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function markTaxFiled(
  householdId: string,
  id: string,
  kind: "federal" | "state"
): Promise<void> {
  if (kind === "federal") {
    await sql`
      UPDATE "TaxYear"
      SET "isFederalFiled" = true, "federalFiledDate" = CURRENT_DATE,
          "updatedAt" = now()
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  } else {
    await sql`
      UPDATE "TaxYear"
      SET "isStateFiled" = true, "stateFiledDate" = CURRENT_DATE,
          "updatedAt" = now()
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  }
}

export async function toggleRefundReceived(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    UPDATE "TaxYear"
    SET "refundReceived" = NOT "refundReceived",
        "refundReceivedDate" = CASE WHEN "refundReceived" THEN NULL ELSE CURRENT_DATE END,
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function toggleOwedPaid(
  householdId: string,
  id: string,
  kind: "federal" | "state"
): Promise<void> {
  if (kind === "federal") {
    await sql`
      UPDATE "TaxYear"
      SET "federalOwedPaid" = NOT "federalOwedPaid", "updatedAt" = now()
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  } else {
    await sql`
      UPDATE "TaxYear"
      SET "stateOwedPaid" = NOT "stateOwedPaid", "updatedAt" = now()
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  }
}

// Deletes the year (documents cascade via FK), then unlinks any uploaded
// files that no remaining TaxDocument row references.
export async function deleteTaxYear(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const paths = await sql<Array<{ storagePath: string }>>`
    SELECT DISTINCT d."storagePath"
    FROM "TaxDocument" d
    JOIN "TaxYear" ty ON ty."id" = d."taxYearId"
    WHERE ty."id" = ${id} AND ty."householdId" = ${householdId}
      AND d."storagePath" IS NOT NULL`

  const deleted = await sql<Array<{ id: string }>>`
    DELETE FROM "TaxYear"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (deleted.length === 0) return { error: "Tax year not found" }

  for (const { storagePath } of paths) {
    await deleteTaxFileIfUnreferenced(storagePath)
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Tax documents (scoped through TaxYear)
// ---------------------------------------------------------------------------

export async function listTaxDocuments(
  householdId: string,
  taxYearId: string
): Promise<Array<TaxDocumentRow>> {
  return sql<Array<TaxDocumentRow>>`
    SELECT d."id", d."documentType", d."issuer", d."description",
           d."grossAmount"::float8, d."federalWithheld"::float8,
           d."stateWithheld"::float8, d."socialSecurityWithheld"::float8,
           d."medicareWithheld"::float8, d."isReceived",
           d."receivedDate"::text, d."expectedDate"::text, d."notes",
           d."uploadedFileName", d."fileSize", d."uploadedAt"
    FROM "TaxDocument" d
    JOIN "TaxYear" ty ON ty."id" = d."taxYearId"
    WHERE d."taxYearId" = ${taxYearId} AND ty."householdId" = ${householdId}
    ORDER BY d."documentType" ASC, d."issuer" ASC`
}

export type TaxDocumentInput = {
  documentType: TaxDocumentType
  issuer: string
  description: string | null
  grossAmount: number | null
  federalWithheld: number | null
  stateWithheld: number | null
  socialSecurityWithheld: number | null
  medicareWithheld: number | null
  expectedDate: string | null
  notes: string | null
}

export async function addTaxDocument(
  householdId: string,
  taxYearId: string,
  input: TaxDocumentInput
): Promise<{ ok: true } | { error: string }> {
  const [year] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "TaxYear"
    WHERE "id" = ${taxYearId} AND "householdId" = ${householdId}`
  if (!year) return { error: "Tax year not found" }

  await sql`
    INSERT INTO "TaxDocument" (
      "taxYearId", "documentType", "issuer", "description", "grossAmount",
      "federalWithheld", "stateWithheld", "socialSecurityWithheld",
      "medicareWithheld", "expectedDate", "notes"
    ) VALUES (
      ${taxYearId}, ${input.documentType}, ${input.issuer},
      ${input.description}, ${input.grossAmount}, ${input.federalWithheld},
      ${input.stateWithheld}, ${input.socialSecurityWithheld},
      ${input.medicareWithheld}, ${input.expectedDate}, ${input.notes}
    )`
  return { ok: true }
}

export async function deleteTaxDocument(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const deleted = await sql<Array<{ storagePath: string | null }>>`
    DELETE FROM "TaxDocument" d
    USING "TaxYear" ty
    WHERE d."taxYearId" = ty."id"
      AND d."id" = ${id} AND ty."householdId" = ${householdId}
    RETURNING d."storagePath"`
  if (deleted.length === 0) return { error: "Document not found" }

  if (deleted[0].storagePath) {
    await deleteTaxFileIfUnreferenced(deleted[0].storagePath)
  }
  return { ok: true }
}

export async function toggleTaxDocumentReceived(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    UPDATE "TaxDocument" d
    SET "isReceived" = NOT d."isReceived",
        "receivedDate" = CASE WHEN d."isReceived" THEN NULL ELSE CURRENT_DATE END,
        "updatedAt" = now()
    FROM "TaxYear" ty
    WHERE d."taxYearId" = ty."id"
      AND d."id" = ${id} AND ty."householdId" = ${householdId}`
}

// ---------------------------------------------------------------------------
// Tax document files
// ---------------------------------------------------------------------------

// Called from the upload API route after magic-byte validation. Replaces an
// existing attachment (legacy behavior), refcount-deleting the old file.
export async function attachTaxDocumentFile(
  householdId: string,
  documentId: string,
  file: { buffer: Uint8Array; originalName: string }
): Promise<{ ok: true } | { error: string }> {
  const [doc] = await sql<Array<{ id: string; storagePath: string | null }>>`
    SELECT d."id", d."storagePath"
    FROM "TaxDocument" d
    JOIN "TaxYear" ty ON ty."id" = d."taxYearId"
    WHERE d."id" = ${documentId} AND ty."householdId" = ${householdId}`
  if (!doc) return { error: "Document not found" }

  const { storagePath, contentHash, size } = await saveFinanceUpload(
    householdId,
    "tax-documents",
    file.buffer,
    file.originalName
  )

  await sql`
    UPDATE "TaxDocument"
    SET "uploadedFileName" = ${file.originalName},
        "storagePath" = ${storagePath}, "fileSize" = ${size},
        "contentHash" = ${contentHash}, "uploadedAt" = now(),
        "updatedAt" = now()
    WHERE "id" = ${doc.id}`

  if (doc.storagePath && doc.storagePath !== storagePath) {
    await deleteTaxFileIfUnreferenced(doc.storagePath)
  }
  return { ok: true }
}

export async function removeTaxDocumentFile(
  householdId: string,
  documentId: string
): Promise<{ ok: true } | { error: string }> {
  const [doc] = await sql<Array<{ id: string; storagePath: string | null }>>`
    SELECT d."id", d."storagePath"
    FROM "TaxDocument" d
    JOIN "TaxYear" ty ON ty."id" = d."taxYearId"
    WHERE d."id" = ${documentId} AND ty."householdId" = ${householdId}`
  if (!doc) return { error: "Document not found" }

  await sql`
    UPDATE "TaxDocument"
    SET "uploadedFileName" = NULL, "storagePath" = NULL, "fileSize" = NULL,
        "contentHash" = NULL, "uploadedAt" = NULL, "updatedAt" = now()
    WHERE "id" = ${doc.id}`

  if (doc.storagePath) {
    await deleteTaxFileIfUnreferenced(doc.storagePath)
  }
  return { ok: true }
}

// File-serving lookup for the download API route. Household-scoped through
// the parent TaxYear — the scope IS the authorization check.
export async function getTaxDocumentFileForServing(
  householdId: string,
  documentId: string
): Promise<{ storagePath: string; uploadedFileName: string } | null> {
  const [row] = await sql<
    Array<{ storagePath: string | null; uploadedFileName: string | null }>
  >`
    SELECT d."storagePath", d."uploadedFileName"
    FROM "TaxDocument" d
    JOIN "TaxYear" ty ON ty."id" = d."taxYearId"
    WHERE d."id" = ${documentId} AND ty."householdId" = ${householdId}`
  if (!row?.storagePath || !row.uploadedFileName) return null
  return {
    storagePath: row.storagePath,
    uploadedFileName: row.uploadedFileName,
  }
}
