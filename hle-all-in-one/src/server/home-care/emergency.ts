import { sql } from "@/server/db"

export type EmergencyContactType =
  | "NEIGHBOR"
  | "UTILITY"
  | "LOCAL_SERVICE"
  | "INSURANCE"
  | "GOVERNMENT"
  | "VETERINARIAN"
  | "OTHER"

export type EmergencyPlanType =
  | "FIRE"
  | "FLOOD"
  | "EARTHQUAKE"
  | "TORNADO"
  | "HURRICANE"
  | "POWER_OUTAGE"
  | "MEDICAL"
  | "INTRUDER"
  | "EVACUATION"
  | "CUSTOM"

export type SupplyCondition = "GOOD" | "LOW" | "EXPIRED" | "NEEDS_REPLACEMENT"

export type EmergencyContactRow = {
  id: string
  name: string
  type: EmergencyContactType
  company: string | null
  phone: string | null
  phoneAlt: string | null
  email: string | null
  address: string | null
  accountNumber: string | null
  availableHours: string | null
  priority: number
  notes: string | null
}

export type EmergencyPlanRow = {
  id: string
  type: EmergencyPlanType
  title: string
  description: string | null
  meetingPoint: string | null
  evacuationRoute: string | null
  procedures: string | null
  lastReviewed: string | null
  reviewFrequencyMonths: number | null
  notes: string | null
}

export type SupplyKitRow = {
  id: string
  name: string
  location: string | null
  roomId: string | null
  roomName: string | null
  description: string | null
  lastChecked: string | null
  notes: string | null
}

export type SupplyRow = {
  id: string
  kitId: string
  name: string
  quantity: number
  unit: string | null
  expirationDate: string | null
  condition: SupplyCondition
  notes: string | null
}

export type ExpiringSupplyRow = {
  id: string
  name: string
  expirationDate: string
  kitName: string
}

export type UtilityShutoffRow = {
  id: string
  utilityType: string
  location: string
  roomId: string | null
  roomName: string | null
  procedure: string | null
  toolsNeeded: string | null
  notes: string | null
}

export type DocumentLocationRow = {
  id: string
  documentName: string
  category: string | null
  physicalLocation: string | null
  digitalLocation: string | null
  accountNumber: string | null
  policyNumber: string | null
  expirationDate: string | null
  notes: string | null
}

export type EmergencyCounts = {
  contactCount: number
  planCount: number
  kitCount: number
  utilityCount: number
  documentCount: number
}

// ─── Overview ────────────────────────────────────────────────────────────────

export async function getEmergencyCounts(
  householdId: string
): Promise<EmergencyCounts> {
  const [counts] = await sql<Array<EmergencyCounts>>`
    SELECT
      (SELECT count(*)::int FROM "EmergencyContact"
        WHERE "householdId" = ${householdId}) AS "contactCount",
      (SELECT count(*)::int FROM "EmergencyPlan"
        WHERE "householdId" = ${householdId}) AS "planCount",
      (SELECT count(*)::int FROM "EmergencySupplyKit"
        WHERE "householdId" = ${householdId}) AS "kitCount",
      (SELECT count(*)::int FROM "UtilityShutoff"
        WHERE "householdId" = ${householdId}) AS "utilityCount",
      (SELECT count(*)::int FROM "ImportantDocumentLocation"
        WHERE "householdId" = ${householdId}) AS "documentCount"`
  return counts
}

// Supplies already expired or expiring within 30 days (scoped through the kit).
export async function listExpiringSupplies(
  householdId: string
): Promise<Array<ExpiringSupplyRow>> {
  return sql<Array<ExpiringSupplyRow>>`
    SELECT s."id", s."name", s."expirationDate"::text, k."name" AS "kitName"
    FROM "EmergencySupply" s
    JOIN "EmergencySupplyKit" k ON k."id" = s."kitId"
    WHERE k."householdId" = ${householdId}
      AND s."expirationDate" IS NOT NULL
      AND s."expirationDate" <= CURRENT_DATE + 30
    ORDER BY s."expirationDate" ASC`
}

// Plans never reviewed, or not reviewed in the last 6 months.
export async function listPlansNeedingReview(
  householdId: string
): Promise<Array<EmergencyPlanRow>> {
  return sql<Array<EmergencyPlanRow>>`
    SELECT "id", "type", "title", "description", "meetingPoint",
           "evacuationRoute", "procedures", "lastReviewed"::text,
           "reviewFrequencyMonths", "notes"
    FROM "EmergencyPlan"
    WHERE "householdId" = ${householdId}
      AND ("lastReviewed" IS NULL OR "lastReviewed" < CURRENT_DATE - 180)
    ORDER BY "lastReviewed" ASC NULLS FIRST`
}

// ─── Rooms (picker options — Room CRUD is owned by the rooms feature) ────────

export async function listRoomOptions(
  householdId: string
): Promise<Array<{ id: string; name: string }>> {
  return sql<Array<{ id: string; name: string }>>`
    SELECT "id", "name" FROM "Room"
    WHERE "householdId" = ${householdId}
    ORDER BY "name" ASC`
}

// ─── Emergency contacts ──────────────────────────────────────────────────────

export async function listEmergencyContacts(
  householdId: string
): Promise<Array<EmergencyContactRow>> {
  return sql<Array<EmergencyContactRow>>`
    SELECT "id", "name", "type", "company", "phone", "phoneAlt", "email",
           "address", "accountNumber", "availableHours", "priority", "notes"
    FROM "EmergencyContact"
    WHERE "householdId" = ${householdId}
    ORDER BY "priority" DESC, "type" ASC, "name" ASC`
}

export type EmergencyContactInput = {
  name: string
  type: EmergencyContactType
  company: string | null
  phone: string | null
  phoneAlt: string | null
  email: string | null
  address: string | null
  accountNumber: string | null
  availableHours: string | null
  priority: number
  notes: string | null
}

export async function createEmergencyContact(
  householdId: string,
  input: EmergencyContactInput
): Promise<void> {
  await sql`
    INSERT INTO "EmergencyContact" (
      "householdId", "name", "type", "company", "phone", "phoneAlt", "email",
      "address", "accountNumber", "availableHours", "priority", "notes"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.type}::"EmergencyContactType",
      ${input.company}, ${input.phone}, ${input.phoneAlt}, ${input.email},
      ${input.address}, ${input.accountNumber}, ${input.availableHours},
      ${input.priority}, ${input.notes}
    )`
}

export async function deleteEmergencyContact(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "EmergencyContact"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// ─── Emergency plans ─────────────────────────────────────────────────────────

export async function listEmergencyPlans(
  householdId: string
): Promise<Array<EmergencyPlanRow>> {
  return sql<Array<EmergencyPlanRow>>`
    SELECT "id", "type", "title", "description", "meetingPoint",
           "evacuationRoute", "procedures", "lastReviewed"::text,
           "reviewFrequencyMonths", "notes"
    FROM "EmergencyPlan"
    WHERE "householdId" = ${householdId}
    ORDER BY "type" ASC, "title" ASC`
}

export async function getEmergencyPlan(
  householdId: string,
  id: string
): Promise<EmergencyPlanRow | null> {
  const rows = await sql<Array<EmergencyPlanRow>>`
    SELECT "id", "type", "title", "description", "meetingPoint",
           "evacuationRoute", "procedures", "lastReviewed"::text,
           "reviewFrequencyMonths", "notes"
    FROM "EmergencyPlan"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

export type EmergencyPlanInput = {
  type: EmergencyPlanType
  title: string
  description: string | null
  meetingPoint: string | null
  evacuationRoute: string | null
  procedures: string | null
  reviewFrequencyMonths: number | null
  notes: string | null
}

export async function createEmergencyPlan(
  householdId: string,
  input: EmergencyPlanInput
): Promise<void> {
  await sql`
    INSERT INTO "EmergencyPlan" (
      "householdId", "type", "title", "description", "meetingPoint",
      "evacuationRoute", "procedures", "reviewFrequencyMonths", "notes"
    ) VALUES (
      ${householdId}, ${input.type}::"EmergencyPlanType", ${input.title},
      ${input.description}, ${input.meetingPoint}, ${input.evacuationRoute},
      ${input.procedures}, ${input.reviewFrequencyMonths}, ${input.notes}
    )`
}

export async function updateEmergencyPlan(
  householdId: string,
  id: string,
  input: EmergencyPlanInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "EmergencyPlan" SET
      "type" = ${input.type}::"EmergencyPlanType",
      "title" = ${input.title},
      "description" = ${input.description},
      "meetingPoint" = ${input.meetingPoint},
      "evacuationRoute" = ${input.evacuationRoute},
      "procedures" = ${input.procedures},
      "reviewFrequencyMonths" = ${input.reviewFrequencyMonths},
      "notes" = ${input.notes},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteEmergencyPlan(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "EmergencyPlan"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function markPlanReviewed(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "EmergencyPlan"
    SET "lastReviewed" = CURRENT_DATE, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// ─── Supply kits ─────────────────────────────────────────────────────────────

export async function listSupplyKits(
  householdId: string
): Promise<Array<SupplyKitRow>> {
  return sql<Array<SupplyKitRow>>`
    SELECT k."id", k."name", k."location", k."roomId", r."name" AS "roomName",
           k."description", k."lastChecked"::text, k."notes"
    FROM "EmergencySupplyKit" k
    LEFT JOIN "Room" r ON r."id" = k."roomId"
    WHERE k."householdId" = ${householdId}
    ORDER BY k."name" ASC`
}

// Child table without householdId — scoped through the parent kit.
export async function listSuppliesForHousehold(
  householdId: string
): Promise<Array<SupplyRow>> {
  return sql<Array<SupplyRow>>`
    SELECT s."id", s."kitId", s."name", s."quantity", s."unit",
           s."expirationDate"::text, s."condition", s."notes"
    FROM "EmergencySupply" s
    JOIN "EmergencySupplyKit" k ON k."id" = s."kitId"
    WHERE k."householdId" = ${householdId}
    ORDER BY s."expirationDate" ASC NULLS LAST, s."name" ASC`
}

export type SupplyKitInput = {
  name: string
  location: string | null
  roomId: string | null
  description: string | null
  notes: string | null
}

export async function createSupplyKit(
  householdId: string,
  input: SupplyKitInput
): Promise<void> {
  await sql`
    INSERT INTO "EmergencySupplyKit"
      ("householdId", "name", "location", "roomId", "description", "notes")
    VALUES (${householdId}, ${input.name}, ${input.location}, ${input.roomId},
            ${input.description}, ${input.notes})`
}

export async function deleteSupplyKit(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "EmergencySupplyKit"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function markKitChecked(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "EmergencySupplyKit"
    SET "lastChecked" = CURRENT_DATE, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Ownership re-check before inserting child rows by parent id (ADR-0005).
export async function kitBelongsToHousehold(
  householdId: string,
  kitId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "EmergencySupplyKit"
    WHERE "id" = ${kitId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

export type SupplyInput = {
  name: string
  quantity: number
  unit: string | null
  expirationDate: string | null
  condition: SupplyCondition
  notes: string | null
}

export async function addSupply(
  kitId: string,
  input: SupplyInput
): Promise<void> {
  await sql`
    INSERT INTO "EmergencySupply"
      ("kitId", "name", "quantity", "unit", "expirationDate", "condition",
       "notes")
    VALUES (${kitId}, ${input.name}, ${input.quantity}, ${input.unit},
            ${input.expirationDate}, ${input.condition}::"SupplyCondition",
            ${input.notes})`
}

export async function deleteSupply(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "EmergencySupply" s
    USING "EmergencySupplyKit" k
    WHERE s."id" = ${id} AND k."id" = s."kitId"
      AND k."householdId" = ${householdId}
    RETURNING s."id"`
  return rows.length > 0
}

// ─── Utility shutoffs ────────────────────────────────────────────────────────

export async function listUtilityShutoffs(
  householdId: string
): Promise<Array<UtilityShutoffRow>> {
  return sql<Array<UtilityShutoffRow>>`
    SELECT u."id", u."utilityType", u."location", u."roomId",
           r."name" AS "roomName", u."procedure", u."toolsNeeded", u."notes"
    FROM "UtilityShutoff" u
    LEFT JOIN "Room" r ON r."id" = u."roomId"
    WHERE u."householdId" = ${householdId}
    ORDER BY u."utilityType" ASC, u."location" ASC`
}

export type UtilityShutoffInput = {
  utilityType: string
  location: string
  roomId: string | null
  procedure: string | null
  toolsNeeded: string | null
  notes: string | null
}

export async function createUtilityShutoff(
  householdId: string,
  input: UtilityShutoffInput
): Promise<void> {
  await sql`
    INSERT INTO "UtilityShutoff"
      ("householdId", "utilityType", "location", "roomId", "procedure",
       "toolsNeeded", "notes")
    VALUES (${householdId}, ${input.utilityType}, ${input.location},
            ${input.roomId}, ${input.procedure}, ${input.toolsNeeded},
            ${input.notes})`
}

export async function deleteUtilityShutoff(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "UtilityShutoff"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// ─── Important document locations (metadata only — no file uploads) ──────────

export async function listDocumentLocations(
  householdId: string
): Promise<Array<DocumentLocationRow>> {
  return sql<Array<DocumentLocationRow>>`
    SELECT "id", "documentName", "category", "physicalLocation",
           "digitalLocation", "accountNumber", "policyNumber",
           "expirationDate"::text, "notes"
    FROM "ImportantDocumentLocation"
    WHERE "householdId" = ${householdId}
    ORDER BY "category" ASC NULLS LAST, "documentName" ASC`
}

export type DocumentLocationInput = {
  documentName: string
  category: string | null
  physicalLocation: string | null
  digitalLocation: string | null
  accountNumber: string | null
  policyNumber: string | null
  expirationDate: string | null
  notes: string | null
}

export async function createDocumentLocation(
  householdId: string,
  input: DocumentLocationInput
): Promise<void> {
  await sql`
    INSERT INTO "ImportantDocumentLocation" (
      "householdId", "documentName", "category", "physicalLocation",
      "digitalLocation", "accountNumber", "policyNumber", "expirationDate",
      "notes"
    ) VALUES (
      ${householdId}, ${input.documentName}, ${input.category},
      ${input.physicalLocation}, ${input.digitalLocation},
      ${input.accountNumber}, ${input.policyNumber}, ${input.expirationDate},
      ${input.notes}
    )`
}

export async function deleteDocumentLocation(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ImportantDocumentLocation"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}
