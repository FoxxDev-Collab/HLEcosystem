import { sql } from "@/server/db"

// Travel documents — metadata only (the legacy page had no file uploads;
// "fileServerFileId" is intentionally ignored). "TravelDocument" is
// householdId-scoped directly: documents can exist without a trip.

export const TRAVEL_DOCUMENT_TYPES = [
  "PASSPORT",
  "VISA",
  "TRAVEL_INSURANCE",
  "DRIVERS_LICENSE",
  "VACCINATION_RECORD",
  "ITINERARY",
  "BOOKING_CONFIRMATION",
  "OTHER",
] as const

export type TravelDocumentType = (typeof TRAVEL_DOCUMENT_TYPES)[number]

export type TravelDocumentRow = {
  id: string
  tripId: string | null
  householdMemberId: string | null
  displayName: string | null
  type: TravelDocumentType
  documentNumber: string | null
  issuingCountry: string | null
  issueDate: string | null
  expiryDate: string | null
  notes: string | null
  tripName: string | null
  ownerName: string | null
}

export type TravelDocumentInput = {
  type: TravelDocumentType
  tripId: string | null
  householdMemberId: string | null
  displayName: string | null
  documentNumber: string | null
  issuingCountry: string | null
  issueDate: string | null
  expiryDate: string | null
  notes: string | null
}

export async function listDocuments(
  householdId: string
): Promise<Array<TravelDocumentRow>> {
  return sql<Array<TravelDocumentRow>>`
    SELECT d."id", d."tripId", d."householdMemberId", d."displayName",
           d."type", d."documentNumber", d."issuingCountry",
           d."issueDate"::text, d."expiryDate"::text, d."notes",
           t."name" AS "tripName", hm."displayName" AS "ownerName"
    FROM "TravelDocument" d
    LEFT JOIN "Trip" t ON t."id" = d."tripId"
    LEFT JOIN "HouseholdMember" hm ON hm."id" = d."householdMemberId"
    WHERE d."householdId" = ${householdId}
    ORDER BY d."type" ASC, d."expiryDate" ASC`
}

export async function listTripOptions(
  householdId: string
): Promise<Array<{ id: string; name: string }>> {
  return sql<Array<{ id: string; name: string }>>`
    SELECT "id", "name" FROM "Trip"
    WHERE "householdId" = ${householdId}
    ORDER BY "name" ASC`
}

// Ownership re-check for ids coming from the client (ADR-0005): never trust
// a tripId or householdMemberId from form data.
async function verifyRefs(
  householdId: string,
  input: TravelDocumentInput
): Promise<string | null> {
  if (input.tripId) {
    const rows = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "Trip"
      WHERE "id" = ${input.tripId} AND "householdId" = ${householdId}`
    if (rows.length === 0) return "Trip not found in this household."
  }
  if (input.householdMemberId) {
    const rows = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "HouseholdMember"
      WHERE "id" = ${input.householdMemberId} AND "householdId" = ${householdId}`
    if (rows.length === 0) return "Member not found in this household."
  }
  return null
}

export async function createDocument(
  householdId: string,
  input: TravelDocumentInput
): Promise<{ ok: true } | { error: string }> {
  const refError = await verifyRefs(householdId, input)
  if (refError) return { error: refError }
  await sql`
    INSERT INTO "TravelDocument"
      ("householdId", "tripId", "householdMemberId", "displayName", "type",
       "documentNumber", "issuingCountry", "issueDate", "expiryDate", "notes")
    VALUES
      (${householdId}, ${input.tripId}, ${input.householdMemberId},
       ${input.displayName}, ${input.type}::"TravelDocumentType",
       ${input.documentNumber}, ${input.issuingCountry}, ${input.issueDate},
       ${input.expiryDate}, ${input.notes})`
  return { ok: true }
}

export async function updateDocument(
  householdId: string,
  id: string,
  input: TravelDocumentInput
): Promise<{ ok: true } | { error: string }> {
  const refError = await verifyRefs(householdId, input)
  if (refError) return { error: refError }
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "TravelDocument"
    SET "tripId" = ${input.tripId},
        "householdMemberId" = ${input.householdMemberId},
        "displayName" = ${input.displayName},
        "type" = ${input.type}::"TravelDocumentType",
        "documentNumber" = ${input.documentNumber},
        "issuingCountry" = ${input.issuingCountry},
        "issueDate" = ${input.issueDate},
        "expiryDate" = ${input.expiryDate},
        "notes" = ${input.notes},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (rows.length === 0) return { error: "Document not found." }
  return { ok: true }
}

export async function deleteDocument(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "TravelDocument"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (rows.length === 0) return { error: "Document not found." }
  return { ok: true }
}
