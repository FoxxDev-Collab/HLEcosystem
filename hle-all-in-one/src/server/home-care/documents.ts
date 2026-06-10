import { sql } from "@/server/db"
import { readSessionToken } from "@/server/auth"
import { validateSession } from "@/server/session"
import { getMembership } from "@/server/households"
import { deleteFileFromDisk } from "@/server/file-storage"

// Auth gate for the raw-Response file endpoints (upload/serve/download),
// mirroring householdMiddleware exactly: session cookie → validateSession →
// re-verify household membership per request (ADR-0005). Server routes return
// Responses instead of redirects, hence this variant.
export async function authenticateFileRequest(): Promise<
  | { ok: true; userId: string; householdId: string }
  | { ok: false; response: Response }
> {
  const token = readSessionToken()
  const session = token ? await validateSession(token) : null
  if (!session) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    }
  }
  if (!session.activeHouseholdId) {
    return {
      ok: false,
      response: new Response("No household", { status: 400 }),
    }
  }
  const membership = await getMembership(
    session.user.id,
    session.activeHouseholdId
  )
  if (!membership) {
    return { ok: false, response: new Response("Forbidden", { status: 403 }) }
  }
  return {
    ok: true,
    userId: session.user.id,
    householdId: session.activeHouseholdId,
  }
}

export type DocumentType =
  | "MANUAL"
  | "WARRANTY"
  | "RECEIPT"
  | "INVOICE"
  | "PHOTO"
  | "OTHER"

export type DocumentRow = {
  id: string
  itemId: string | null
  vehicleId: string | null
  repairId: string | null
  type: DocumentType
  name: string
  originalName: string
  mimeType: string
  size: number
  notes: string | null
  createdAt: Date
  contentHash: string
  itemName: string | null
  vehicleYear: number | null
  vehicleMake: string | null
  vehicleModel: string | null
  repairTitle: string | null
}

export type RepairOption = { id: string; title: string }

export async function listRepairOptions(
  householdId: string
): Promise<Array<RepairOption>> {
  return sql<Array<RepairOption>>`
    SELECT "id", "title"
    FROM "Repair"
    WHERE "householdId" = ${householdId}
    ORDER BY "reportedDate" DESC
    LIMIT 50`
}

export async function listDocuments(
  householdId: string
): Promise<Array<DocumentRow>> {
  return sql<Array<DocumentRow>>`
    SELECT d."id", d."itemId", d."vehicleId", d."repairId", d."type",
           d."name", d."originalName", d."mimeType", d."size"::float8,
           d."notes", d."createdAt", d."contentHash",
           i."name" AS "itemName",
           v."year" AS "vehicleYear", v."make" AS "vehicleMake",
           v."model" AS "vehicleModel",
           r."title" AS "repairTitle"
    FROM "Document" d
    LEFT JOIN "Item" i ON i."id" = d."itemId"
    LEFT JOIN "Vehicle" v ON v."id" = d."vehicleId"
    LEFT JOIN "Repair" r ON r."id" = d."repairId"
    WHERE d."householdId" = ${householdId}
    ORDER BY d."createdAt" DESC
    LIMIT 100`
}

export async function getDocument(
  householdId: string,
  id: string
): Promise<DocumentRow | null> {
  const rows = await sql<Array<DocumentRow>>`
    SELECT d."id", d."itemId", d."vehicleId", d."repairId", d."type",
           d."name", d."originalName", d."mimeType", d."size"::float8,
           d."notes", d."createdAt", d."contentHash",
           i."name" AS "itemName",
           v."year" AS "vehicleYear", v."make" AS "vehicleMake",
           v."model" AS "vehicleModel",
           r."title" AS "repairTitle"
    FROM "Document" d
    LEFT JOIN "Item" i ON i."id" = d."itemId"
    LEFT JOIN "Vehicle" v ON v."id" = d."vehicleId"
    LEFT JOIN "Repair" r ON r."id" = d."repairId"
    WHERE d."id" = ${id} AND d."householdId" = ${householdId}`
  return rows[0] ?? null
}

// File-serving lookup for the API endpoints. Household-scoped — the scope
// IS the authorization check for reading bytes off disk.
export type ServableDocument = {
  id: string
  originalName: string
  mimeType: string
  storagePath: string
}

export async function getDocumentForServing(
  householdId: string,
  id: string
): Promise<ServableDocument | null> {
  const rows = await sql<Array<ServableDocument>>`
    SELECT "id", "originalName", "mimeType", "storagePath"
    FROM "Document"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

export type UploadedDocumentInput = {
  type: DocumentType
  name: string
  originalName: string
  mimeType: string
  size: number
  storagePath: string
  contentHash: string
  uploadedById: string
  itemId: string | null
  vehicleId: string | null
  repairId: string | null
  notes: string | null
}

// Foreign ids are re-scoped via subselects — a cross-household id resolves
// to NULL instead of linking another tenant's row (ADR-0005).
export async function insertUploadedDocument(
  householdId: string,
  input: UploadedDocumentInput
): Promise<{ id: string; name: string; size: number }> {
  const rows = await sql<Array<{ id: string; name: string; size: number }>>`
    INSERT INTO "Document" (
      "householdId", "itemId", "vehicleId", "repairId", "type", "name",
      "originalName", "mimeType", "size", "storagePath", "contentHash",
      "uploadedById", "notes"
    ) VALUES (
      ${householdId},
      (SELECT "id" FROM "Item"
       WHERE "id" = ${input.itemId} AND "householdId" = ${householdId}),
      (SELECT "id" FROM "Vehicle"
       WHERE "id" = ${input.vehicleId} AND "householdId" = ${householdId}),
      (SELECT "id" FROM "Repair"
       WHERE "id" = ${input.repairId} AND "householdId" = ${householdId}),
      ${input.type}::"DocumentType", ${input.name}, ${input.originalName},
      ${input.mimeType}, ${input.size}, ${input.storagePath},
      ${input.contentHash}, ${input.uploadedById}, ${input.notes}
    ) RETURNING "id", "name", "size"::float8`
  return rows[0]
}

export type DocumentUpdateInput = {
  name: string
  type: DocumentType
  notes: string | null
  itemId: string | null
  vehicleId: string | null
  repairId: string | null
}

export async function updateDocument(
  householdId: string,
  id: string,
  input: DocumentUpdateInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Document" SET
      "name" = ${input.name},
      "type" = ${input.type}::"DocumentType",
      "notes" = ${input.notes},
      "itemId" = (SELECT "id" FROM "Item"
                  WHERE "id" = ${input.itemId} AND "householdId" = ${householdId}),
      "vehicleId" = (SELECT "id" FROM "Vehicle"
                     WHERE "id" = ${input.vehicleId} AND "householdId" = ${householdId}),
      "repairId" = (SELECT "id" FROM "Repair"
                    WHERE "id" = ${input.repairId} AND "householdId" = ${householdId}),
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Deletes the row, and the file on disk only when no other Document row still
// references the same storagePath. Refcounting by storagePath (not by global
// contentHash, the legacy bug): storage paths embed the householdId and the
// extension, so equal hashes can still mean different files on disk.
export async function deleteDocument(
  householdId: string,
  id: string
): Promise<boolean> {
  const docs = await sql<Array<{ id: string; storagePath: string }>>`
    SELECT "id", "storagePath" FROM "Document"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  const doc = docs[0]
  if (!doc) return false

  const refs = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "Document"
    WHERE "storagePath" = ${doc.storagePath} AND "id" <> ${doc.id}`
  const otherRefs = refs[0]?.count ?? 0

  await sql`
    DELETE FROM "Document"
    WHERE "id" = ${doc.id} AND "householdId" = ${householdId}`

  if (otherRefs === 0) {
    await deleteFileFromDisk(doc.storagePath)
  }
  return true
}
