// Health profiles are append-only point-in-time records: every save creates a
// new "HealthProfileRecord"; the "current" profile is the latest recordDate
// per member, history is preserved (legacy semantics). Metric units
// (cm / kg) are stored; display-side conversion is the UI's job.
import { pgTextArray, sql } from "@/server/db"

export type BloodType =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE"
  | "UNKNOWN"

export type ProfileRecordRow = {
  id: string
  memberId: string
  recordDate: string
  bloodType: BloodType
  heightCm: number | null
  weightKg: number | null
  allergies: Array<string>
  chronicConditions: Array<string>
  majorSurgeries: Array<string>
  primaryCareProvider: string | null
  preferredHospital: string | null
  medicalNotes: string | null
  isOrganDonor: boolean
}

export type ProfileRecordInput = {
  recordDate: string
  bloodType: BloodType
  heightCm: number | null
  weightKg: number | null
  allergies: Array<string>
  chronicConditions: Array<string>
  majorSurgeries: Array<string>
  primaryCareProvider: string | null
  preferredHospital: string | null
  medicalNotes: string | null
  isOrganDonor: boolean
}

// All records for the household, newest first; the UI groups by member
// (legacy page loaded every member's full history the same way).
export async function listProfileRecords(
  householdId: string
): Promise<Array<ProfileRecordRow>> {
  return sql<Array<ProfileRecordRow>>`
    SELECT r."id", r."memberId", r."recordDate"::text,
           r."bloodType"::text AS "bloodType", r."heightCm"::float8,
           r."weightKg"::float8, r."allergies", r."chronicConditions",
           r."majorSurgeries", r."primaryCareProvider", r."preferredHospital",
           r."medicalNotes", r."isOrganDonor"
    FROM "HealthProfileRecord" r
    JOIN "HealthMember" hm ON hm."id" = r."memberId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY r."recordDate" DESC, r."createdAt" DESC`
}

// The "current" profile = latest record for the member.
export async function getLatestProfileRecord(
  householdId: string,
  memberId: string
): Promise<ProfileRecordRow | null> {
  const rows = await sql<Array<ProfileRecordRow>>`
    SELECT r."id", r."memberId", r."recordDate"::text,
           r."bloodType"::text AS "bloodType", r."heightCm"::float8,
           r."weightKg"::float8, r."allergies", r."chronicConditions",
           r."majorSurgeries", r."primaryCareProvider", r."preferredHospital",
           r."medicalNotes", r."isOrganDonor"
    FROM "HealthProfileRecord" r
    JOIN "HealthMember" hm ON hm."id" = r."memberId"
    WHERE r."memberId" = ${memberId} AND hm."householdId" = ${householdId}
    ORDER BY r."recordDate" DESC, r."createdAt" DESC
    LIMIT 1`
  return rows[0] ?? null
}

// Append-only: always INSERT, never UPDATE an existing record.
// Caller re-verifies member ownership first.
export async function createProfileRecord(
  memberId: string,
  input: ProfileRecordInput
): Promise<void> {
  await sql`
    INSERT INTO "HealthProfileRecord" (
      "memberId", "recordDate", "bloodType", "heightCm", "weightKg",
      "allergies", "chronicConditions", "majorSurgeries",
      "primaryCareProvider", "preferredHospital", "medicalNotes",
      "isOrganDonor"
    ) VALUES (
      ${memberId}, ${input.recordDate}, ${input.bloodType}::"BloodType",
      ${input.heightCm}, ${input.weightKg},
      ${pgTextArray(input.allergies)}::text[],
      ${pgTextArray(input.chronicConditions)}::text[],
      ${pgTextArray(input.majorSurgeries)}::text[],
      ${input.primaryCareProvider}, ${input.preferredHospital},
      ${input.medicalNotes}, ${input.isOrganDonor}
    )`
}

export async function deleteProfileRecord(
  householdId: string,
  recordId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "HealthProfileRecord" r
    USING "HealthMember" hm
    WHERE r."id" = ${recordId} AND hm."id" = r."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING r."id"`
  return rows.length > 0
}
