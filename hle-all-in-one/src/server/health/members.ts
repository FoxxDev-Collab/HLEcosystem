// Health member lifecycle. "HealthMember" is an opt-in snapshot of a hub
// "FamilyMember" (legacy "enable health tracking" flow): name/DOB/relationship
// are synced copies so health pages render without joining hub on every query.
// The legacy picker read familyhub."FamilyMember" cross-schema; here the hub
// module's "FamilyMember" table lives in the same database and is queried
// directly (householdId-scoped).
import { sql } from "@/server/db"

export type HubMemberRow = {
  id: string
  linkedUserId: string | null
  firstName: string
  lastName: string
  birthday: string | null
  relationship: string | null
}

export type HealthMemberRow = {
  id: string
  familyMemberId: string | null
  linkedUserId: string | null
  firstName: string
  lastName: string
  dateOfBirth: string | null
  relationship: string | null
  gender: string | null
  isActive: boolean
}

export type HealthMemberStatsRow = HealthMemberRow & {
  profileCount: number
  activeMedicationCount: number
  appointmentCount: number
  vaccinationCount: number
}

export type MemberOption = {
  id: string
  firstName: string
  lastName: string
}

// ─── Hub source-of-truth reads ──────────────────────────

export async function listHubMembers(
  householdId: string
): Promise<Array<HubMemberRow>> {
  return sql<Array<HubMemberRow>>`
    SELECT "id", "linkedUserId", "firstName", "lastName", "birthday"::text,
           "relationship"::text
    FROM "FamilyMember"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "firstName" ASC, "lastName" ASC`
}

export async function getHubMember(
  householdId: string,
  id: string
): Promise<HubMemberRow | null> {
  const rows = await sql<Array<HubMemberRow>>`
    SELECT "id", "linkedUserId", "firstName", "lastName", "birthday"::text,
           "relationship"::text
    FROM "FamilyMember"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

// ─── Health member reads ────────────────────────────────

export async function listHealthMembersWithStats(
  householdId: string
): Promise<Array<HealthMemberStatsRow>> {
  return sql<Array<HealthMemberStatsRow>>`
    SELECT hm."id", hm."familyMemberId", hm."linkedUserId", hm."firstName",
           hm."lastName", hm."dateOfBirth"::text, hm."relationship",
           hm."gender", hm."isActive",
           (SELECT count(*)::int FROM "HealthProfileRecord" p
             WHERE p."memberId" = hm."id") AS "profileCount",
           (SELECT count(*)::int FROM "Medication" md
             WHERE md."memberId" = hm."id" AND md."isActive")
             AS "activeMedicationCount",
           (SELECT count(*)::int FROM "Appointment" a
             WHERE a."memberId" = hm."id") AS "appointmentCount",
           (SELECT count(*)::int FROM "Vaccination" v
             WHERE v."memberId" = hm."id") AS "vaccinationCount"
    FROM "HealthMember" hm
    WHERE hm."householdId" = ${householdId}
    ORDER BY hm."firstName" ASC, hm."lastName" ASC`
}

export async function listActiveHealthMembers(
  householdId: string
): Promise<Array<MemberOption>> {
  return sql<Array<MemberOption>>`
    SELECT "id", "firstName", "lastName"
    FROM "HealthMember"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "firstName" ASC, "lastName" ASC`
}

export async function getHealthMember(
  householdId: string,
  id: string
): Promise<HealthMemberRow | null> {
  const rows = await sql<Array<HealthMemberRow>>`
    SELECT "id", "familyMemberId", "linkedUserId", "firstName", "lastName",
           "dateOfBirth"::text, "relationship", "gender", "isActive"
    FROM "HealthMember"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

// Ownership re-check before mutating child rows by parent id (ADR-0005).
export async function healthMemberBelongsToHousehold(
  householdId: string,
  memberId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "HealthMember"
    WHERE "id" = ${memberId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// ─── Enable tracking (reactivate / adopt / create) ──────

export async function enableHealthTracking(
  householdId: string,
  familyMemberId: string
): Promise<{ ok: true } | { error: string }> {
  const hub = await getHubMember(householdId, familyMemberId)
  if (!hub) return { error: "Family member not found." }

  // Already tracked via this hub link — reactivate if previously disabled.
  const existing = await sql<Array<{ id: string; isActive: boolean }>>`
    SELECT "id", "isActive" FROM "HealthMember"
    WHERE "householdId" = ${householdId}
      AND "familyMemberId" = ${familyMemberId}`
  if (existing[0]) {
    if (!existing[0].isActive) {
      await sql`
        UPDATE "HealthMember"
        SET "isActive" = true, "updatedAt" = now()
        WHERE "id" = ${existing[0].id} AND "householdId" = ${householdId}`
    }
    return { ok: true }
  }

  // Adopt a legacy member with the same linkedUserId (created before the hub
  // integration): link it to the hub row, re-copy the snapshot, reactivate.
  if (hub.linkedUserId) {
    const legacy = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "HealthMember"
      WHERE "householdId" = ${householdId}
        AND "linkedUserId" = ${hub.linkedUserId}`
    if (legacy[0]) {
      await sql`
        UPDATE "HealthMember"
        SET "familyMemberId" = ${familyMemberId},
            "firstName" = ${hub.firstName},
            "lastName" = ${hub.lastName},
            "dateOfBirth" = ${hub.birthday},
            "relationship" = ${hub.relationship},
            "isActive" = true,
            "updatedAt" = now()
        WHERE "id" = ${legacy[0].id} AND "householdId" = ${householdId}`
      return { ok: true }
    }
  }

  // Fresh snapshot from the hub row.
  await sql`
    INSERT INTO "HealthMember" (
      "householdId", "familyMemberId", "linkedUserId", "firstName",
      "lastName", "dateOfBirth", "relationship"
    ) VALUES (
      ${householdId}, ${familyMemberId}, ${hub.linkedUserId},
      ${hub.firstName}, ${hub.lastName}, ${hub.birthday}, ${hub.relationship}
    )`
  return { ok: true }
}

// ─── Disable tracking ───────────────────────────────────

// Hard-delete only when no health data exists; otherwise soft-deactivate to
// preserve records (legacy safety rule).
export async function disableHealthTracking(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const member = await getHealthMember(householdId, id)
  if (!member) return { error: "Member not found." }

  const [counts] = await sql<
    Array<{ appointments: number; medications: number; vaccinations: number }>
  >`
    SELECT
      (SELECT count(*)::int FROM "Appointment"
        WHERE "memberId" = ${id}) AS "appointments",
      (SELECT count(*)::int FROM "Medication"
        WHERE "memberId" = ${id}) AS "medications",
      (SELECT count(*)::int FROM "Vaccination"
        WHERE "memberId" = ${id}) AS "vaccinations"`
  const total = counts.appointments + counts.medications + counts.vaccinations

  if (total > 0) {
    await sql`
      UPDATE "HealthMember"
      SET "isActive" = false, "updatedAt" = now()
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  } else {
    await sql`
      DELETE FROM "HealthMember"
      WHERE "id" = ${id} AND "householdId" = ${householdId}`
  }
  return { ok: true }
}

// ─── Sync snapshot from hub ─────────────────────────────

// Re-copies name/DOB/relationship/linked user from the hub FamilyMember row.
export async function syncMemberFromHub(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const member = await getHealthMember(householdId, id)
  if (!member) return { error: "Member not found." }
  if (!member.familyMemberId) {
    return { error: "This member is not linked to a hub family member." }
  }
  const hub = await getHubMember(householdId, member.familyMemberId)
  if (!hub) return { error: "Linked hub family member no longer exists." }

  await sql`
    UPDATE "HealthMember"
    SET "firstName" = ${hub.firstName},
        "lastName" = ${hub.lastName},
        "dateOfBirth" = ${hub.birthday},
        "relationship" = ${hub.relationship},
        "linkedUserId" = ${hub.linkedUserId},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return { ok: true }
}

// ─── Member detail (read-only child summaries) ──────────
// Medication/Vaccination/HealthEmergencyContact mutations live in another
// module; these are display-only reads, scoped through "HealthMember".

export type MemberMedicationRow = {
  id: string
  medicationName: string
  dosage: string | null
  frequency: string | null
}

export type MemberAppointmentRow = {
  id: string
  appointmentType: string
  appointmentDateTime: Date
  providerName: string | null
}

export type MemberVaccinationRow = {
  id: string
  vaccineName: string
  dateAdministered: string
}

export type MemberEmergencyContactRow = {
  id: string
  name: string
  relationship: string
  phoneNumber: string
}

export async function listActiveMedicationsForMember(
  householdId: string,
  memberId: string
): Promise<Array<MemberMedicationRow>> {
  return sql<Array<MemberMedicationRow>>`
    SELECT md."id", md."medicationName", md."dosage", md."frequency"
    FROM "Medication" md
    JOIN "HealthMember" hm ON hm."id" = md."memberId"
    WHERE md."memberId" = ${memberId}
      AND hm."householdId" = ${householdId}
      AND md."isActive"
    ORDER BY md."medicationName" ASC`
}

export async function listScheduledAppointmentsForMember(
  householdId: string,
  memberId: string
): Promise<Array<MemberAppointmentRow>> {
  return sql<Array<MemberAppointmentRow>>`
    SELECT a."id", a."appointmentType"::text AS "appointmentType",
           a."appointmentDateTime", p."name" AS "providerName"
    FROM "Appointment" a
    JOIN "HealthMember" hm ON hm."id" = a."memberId"
    LEFT JOIN "Provider" p ON p."id" = a."providerId"
    WHERE a."memberId" = ${memberId}
      AND hm."householdId" = ${householdId}
      AND a."status" = 'SCHEDULED'
    ORDER BY a."appointmentDateTime" ASC
    LIMIT 5`
}

export async function listRecentVaccinationsForMember(
  householdId: string,
  memberId: string
): Promise<Array<MemberVaccinationRow>> {
  return sql<Array<MemberVaccinationRow>>`
    SELECT v."id", v."vaccineName", v."dateAdministered"::text
    FROM "Vaccination" v
    JOIN "HealthMember" hm ON hm."id" = v."memberId"
    WHERE v."memberId" = ${memberId} AND hm."householdId" = ${householdId}
    ORDER BY v."dateAdministered" DESC
    LIMIT 5`
}

export async function listEmergencyContactsForMember(
  householdId: string,
  memberId: string
): Promise<Array<MemberEmergencyContactRow>> {
  return sql<Array<MemberEmergencyContactRow>>`
    SELECT ec."id", ec."name", ec."relationship", ec."phoneNumber"
    FROM "HealthEmergencyContact" ec
    JOIN "HealthMember" hm ON hm."id" = ec."memberId"
    WHERE ec."memberId" = ${memberId} AND hm."householdId" = ${householdId}
    ORDER BY ec."priority" ASC`
}
