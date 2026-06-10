// Medications port from hle-family_health /medications. "Medication" rows
// have no householdId of their own — every query scopes through the parent
// "HealthMember"."householdId" (same approach as "Address" -> "FamilyMember").
import { sql } from "@/server/db"

// ─── Shared member picker ────────────────────────────────────────────────────
// Read-only picker over "HealthMember" (active members of the household) used
// by the child-record features ported in this batch: medications,
// vaccinations, insurance coverage, emergency contacts, and expenses. The
// HealthMember CRUD itself lives in the family-members port — these are
// deliberately read-only queries.

export type HealthMemberOption = {
  id: string
  firstName: string
  lastName: string
}

export async function listActiveHealthMembers(
  householdId: string
): Promise<Array<HealthMemberOption>> {
  return sql<Array<HealthMemberOption>>`
    SELECT "id", "firstName", "lastName"
    FROM "HealthMember"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "firstName" ASC, "lastName" ASC`
}

// Ownership re-check before inserting child rows for a client-supplied
// memberId (ADR-0005).
export async function healthMemberBelongsToHousehold(
  householdId: string,
  memberId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "HealthMember"
    WHERE "id" = ${memberId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// ─── Medications ─────────────────────────────────────────────────────────────

export type MedicationRow = {
  id: string
  memberId: string
  memberFirstName: string
  memberLastName: string
  medicationName: string
  dosage: string | null
  frequency: string | null
  startDate: string | null
  isActive: boolean
  prescribedBy: string | null
  pharmacy: string | null
  lastRefillDate: string | null
  nextRefillDate: string | null
  refillsRemaining: number | null
  purpose: string | null
  costPerRefill: number | null
  paidFromHsa: boolean
}

export type MedicationInput = {
  medicationName: string
  dosage: string | null
  frequency: string | null
  prescribedBy: string | null
  pharmacy: string | null
  purpose: string | null
  startDate: string | null
  nextRefillDate: string | null
  refillsRemaining: number | null
  costPerRefill: number | null
  paidFromHsa: boolean
}

export async function listMedications(
  householdId: string
): Promise<Array<MedicationRow>> {
  return sql<Array<MedicationRow>>`
    SELECT md."id", md."memberId",
           hm."firstName" AS "memberFirstName",
           hm."lastName" AS "memberLastName",
           md."medicationName", md."dosage", md."frequency",
           md."startDate"::text, md."isActive", md."prescribedBy",
           md."pharmacy", md."lastRefillDate"::text, md."nextRefillDate"::text,
           md."refillsRemaining", md."purpose", md."costPerRefill"::float8,
           md."paidFromHsa"
    FROM "Medication" md
    JOIN "HealthMember" hm ON hm."id" = md."memberId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY md."isActive" DESC, md."medicationName" ASC`
}

export async function createMedication(
  memberId: string,
  input: MedicationInput
): Promise<void> {
  // Caller must verify memberId ownership via healthMemberBelongsToHousehold.
  await sql`
    INSERT INTO "Medication" (
      "memberId", "medicationName", "dosage", "frequency", "prescribedBy",
      "pharmacy", "purpose", "startDate", "nextRefillDate", "refillsRemaining",
      "costPerRefill", "paidFromHsa"
    ) VALUES (
      ${memberId}, ${input.medicationName}, ${input.dosage},
      ${input.frequency}, ${input.prescribedBy}, ${input.pharmacy},
      ${input.purpose}, ${input.startDate}, ${input.nextRefillDate},
      ${input.refillsRemaining}, ${input.costPerRefill}, ${input.paidFromHsa}
    )`
}

export async function toggleMedicationActive(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Medication" md
    SET "isActive" = NOT md."isActive", "updatedAt" = now()
    FROM "HealthMember" hm
    WHERE md."id" = ${id} AND hm."id" = md."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING md."id"`
  return rows.length > 0
}

// Legacy refill rule: stamp today as lastRefillDate and decrement
// refillsRemaining, never below zero; a NULL count stays NULL.
export async function recordRefill(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Medication" md
    SET "lastRefillDate" = CURRENT_DATE,
        "refillsRemaining" = CASE
          WHEN md."refillsRemaining" IS NULL THEN NULL
          ELSE GREATEST(0, md."refillsRemaining" - 1)
        END,
        "updatedAt" = now()
    FROM "HealthMember" hm
    WHERE md."id" = ${id} AND hm."id" = md."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING md."id"`
  return rows.length > 0
}

export async function deleteMedication(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Medication" md
    USING "HealthMember" hm
    WHERE md."id" = ${id} AND hm."id" = md."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING md."id"`
  return rows.length > 0
}
