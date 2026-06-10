// Vaccinations port from hle-family_health /vaccinations. Series tracking is
// deliberately free-text: doseNumber is a label ("1st", "Booster") and
// nextDoseDate drives the "upcoming doses" list. Rows scope through
// "HealthMember"."householdId".
import { sql } from "@/server/db"

export type VaccinationRow = {
  id: string
  memberId: string
  memberFirstName: string
  memberLastName: string
  vaccineName: string
  doseNumber: string | null
  dateAdministered: string
  nextDoseDate: string | null
  administeredBy: string | null
  lotNumber: string | null
  notes: string | null
}

export type VaccinationInput = {
  vaccineName: string
  doseNumber: string | null
  dateAdministered: string
  nextDoseDate: string | null
  administeredBy: string | null
  lotNumber: string | null
  notes: string | null
}

export async function listVaccinations(
  householdId: string
): Promise<Array<VaccinationRow>> {
  return sql<Array<VaccinationRow>>`
    SELECT v."id", v."memberId",
           hm."firstName" AS "memberFirstName",
           hm."lastName" AS "memberLastName",
           v."vaccineName", v."doseNumber", v."dateAdministered"::text,
           v."nextDoseDate"::text, v."administeredBy", v."lotNumber", v."notes"
    FROM "Vaccination" v
    JOIN "HealthMember" hm ON hm."id" = v."memberId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY v."dateAdministered" DESC`
}

export async function createVaccination(
  memberId: string,
  input: VaccinationInput
): Promise<void> {
  // Caller must verify memberId ownership via healthMemberBelongsToHousehold.
  await sql`
    INSERT INTO "Vaccination" (
      "memberId", "vaccineName", "doseNumber", "dateAdministered",
      "nextDoseDate", "administeredBy", "lotNumber", "notes"
    ) VALUES (
      ${memberId}, ${input.vaccineName}, ${input.doseNumber},
      ${input.dateAdministered}, ${input.nextDoseDate},
      ${input.administeredBy}, ${input.lotNumber}, ${input.notes}
    )`
}

export async function deleteVaccination(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Vaccination" v
    USING "HealthMember" hm
    WHERE v."id" = ${id} AND hm."id" = v."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING v."id"`
  return rows.length > 0
}
