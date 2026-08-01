// Visit summaries: after-the-fact records of medical visits, optionally
// linked 1:1 to an "Appointment" ("appointmentId" is UNIQUE — a duplicate
// link is rejected with { error } in the server fn). Scoped through
// "HealthMember"."householdId".
//
// Note: the legacy health app's finance-bridge was only ever wired to the
// /expenses page, NOT to visits (no finance import exists in the legacy
// visits/actions.ts). Visit costs ("paidFromHsa", billed/insurance/
// out-of-pocket) stay plain data here; the expenses page's finance sync
// (fns.expenses.ts) is the hand-off, same as legacy.
import { sql } from "@/server/db"

export type VisitType =
  "IN_PERSON" | "TELEHEALTH" | "EMERGENCY" | "HOSPITAL" | "URGENT_CARE"

export type VisitSummaryRow = {
  id: string
  appointmentId: string | null
  memberId: string
  providerId: string | null
  visitDate: Date
  visitType: VisitType
  chiefComplaint: string | null
  diagnosis: string | null
  treatmentProvided: string | null
  prescriptionsWritten: string | null
  labTestsOrdered: string | null
  followUpInstructions: string | null
  notes: string | null
  billedAmount: number | null
  insurancePaid: number | null
  outOfPocketCost: number | null
  paidFromHsa: boolean
  memberFirstName: string
  memberLastName: string
  providerName: string | null
}

export type VisitSummaryInput = {
  appointmentId: string | null
  providerId: string | null
  visitDate: Date
  visitType: VisitType
  chiefComplaint: string | null
  diagnosis: string | null
  treatmentProvided: string | null
  prescriptionsWritten: string | null
  labTestsOrdered: string | null
  followUpInstructions: string | null
  notes: string | null
  billedAmount: number | null
  insurancePaid: number | null
  outOfPocketCost: number | null
  paidFromHsa: boolean
}

export type LinkableAppointmentRow = {
  id: string
  memberId: string
  appointmentDateTime: Date
  appointmentType: string
  memberFirstName: string
  memberLastName: string
}

export async function listVisitSummaries(
  householdId: string
): Promise<Array<VisitSummaryRow>> {
  return sql<Array<VisitSummaryRow>>`
    SELECT v."id", v."appointmentId", v."memberId", v."providerId",
           v."visitDate", v."visitType"::text AS "visitType",
           v."chiefComplaint", v."diagnosis", v."treatmentProvided",
           v."prescriptionsWritten", v."labTestsOrdered",
           v."followUpInstructions", v."notes", v."billedAmount"::float8,
           v."insurancePaid"::float8, v."outOfPocketCost"::float8,
           v."paidFromHsa",
           hm."firstName" AS "memberFirstName",
           hm."lastName" AS "memberLastName",
           p."name" AS "providerName"
    FROM "VisitSummary" v
    JOIN "HealthMember" hm ON hm."id" = v."memberId"
    LEFT JOIN "Provider" p ON p."id" = v."providerId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY v."visitDate" DESC
    LIMIT 50`
}

// Appointments that don't have a visit summary yet — options for the
// optional 1:1 link on the record-visit form.
export async function listLinkableAppointments(
  householdId: string
): Promise<Array<LinkableAppointmentRow>> {
  return sql<Array<LinkableAppointmentRow>>`
    SELECT a."id", a."memberId", a."appointmentDateTime",
           a."appointmentType"::text AS "appointmentType",
           hm."firstName" AS "memberFirstName",
           hm."lastName" AS "memberLastName"
    FROM "Appointment" a
    JOIN "HealthMember" hm ON hm."id" = a."memberId"
    LEFT JOIN "VisitSummary" v ON v."appointmentId" = a."id"
    WHERE hm."householdId" = ${householdId} AND v."id" IS NULL
    ORDER BY a."appointmentDateTime" DESC
    LIMIT 50`
}

export async function appointmentAlreadyLinked(
  appointmentId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "VisitSummary"
    WHERE "appointmentId" = ${appointmentId}`
  return rows.length > 0
}

// Caller re-verifies member / provider / appointment ownership first.
export async function createVisitSummary(
  memberId: string,
  input: VisitSummaryInput
): Promise<void> {
  await sql`
    INSERT INTO "VisitSummary" (
      "appointmentId", "memberId", "providerId", "visitDate", "visitType",
      "chiefComplaint", "diagnosis", "treatmentProvided",
      "prescriptionsWritten", "labTestsOrdered", "followUpInstructions",
      "notes", "billedAmount", "insurancePaid", "outOfPocketCost",
      "paidFromHsa"
    ) VALUES (
      ${input.appointmentId}, ${memberId}, ${input.providerId},
      ${input.visitDate}, ${input.visitType}::"VisitType",
      ${input.chiefComplaint}, ${input.diagnosis}, ${input.treatmentProvided},
      ${input.prescriptionsWritten}, ${input.labTestsOrdered},
      ${input.followUpInstructions}, ${input.notes}, ${input.billedAmount},
      ${input.insurancePaid}, ${input.outOfPocketCost}, ${input.paidFromHsa}
    )`
}

export async function deleteVisitSummary(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "VisitSummary" v
    USING "HealthMember" hm
    WHERE v."id" = ${id} AND hm."id" = v."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING v."id"`
  return rows.length > 0
}
