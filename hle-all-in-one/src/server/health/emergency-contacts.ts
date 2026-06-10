// Emergency contacts port from hle-family_health /emergency-contacts. Legacy
// table "EmergencyContact" is "HealthEmergencyContact" here (home care owns
// the unprefixed name). Rows scope through "HealthMember"."householdId".
import { sql } from "@/server/db"

export type HealthEmergencyContactRow = {
  id: string
  memberId: string
  memberFirstName: string
  memberLastName: string
  name: string
  relationship: string
  phoneNumber: string
  alternatePhone: string | null
  email: string | null
  address: string | null
  priority: number
}

export type HealthEmergencyContactInput = {
  name: string
  relationship: string
  phoneNumber: string
  alternatePhone: string | null
  email: string | null
  address: string | null
  priority: number
}

export async function listHealthEmergencyContacts(
  householdId: string
): Promise<Array<HealthEmergencyContactRow>> {
  return sql<Array<HealthEmergencyContactRow>>`
    SELECT c."id", c."memberId",
           hm."firstName" AS "memberFirstName",
           hm."lastName" AS "memberLastName",
           c."name", c."relationship", c."phoneNumber", c."alternatePhone",
           c."email", c."address", c."priority"
    FROM "HealthEmergencyContact" c
    JOIN "HealthMember" hm ON hm."id" = c."memberId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY c."priority" ASC, c."name" ASC`
}

export async function createHealthEmergencyContact(
  memberId: string,
  input: HealthEmergencyContactInput
): Promise<void> {
  // Caller must verify memberId ownership via healthMemberBelongsToHousehold.
  await sql`
    INSERT INTO "HealthEmergencyContact" (
      "memberId", "name", "relationship", "phoneNumber", "alternatePhone",
      "email", "address", "priority"
    ) VALUES (
      ${memberId}, ${input.name}, ${input.relationship}, ${input.phoneNumber},
      ${input.alternatePhone}, ${input.email}, ${input.address},
      ${input.priority}
    )`
}

export async function deleteHealthEmergencyContact(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "HealthEmergencyContact" c
    USING "HealthMember" hm
    WHERE c."id" = ${id} AND hm."id" = c."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING c."id"`
  return rows.length > 0
}
