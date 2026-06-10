// Appointments: scheduled medical visits per health member. No householdId of
// its own — every query scopes through "HealthMember"."householdId".
import { sql } from "@/server/db"

export type AppointmentType =
  | "ANNUAL_CHECKUP"
  | "FOLLOW_UP"
  | "SPECIALIST"
  | "PROCEDURE"
  | "LAB_WORK"
  | "DENTAL"
  | "VISION"
  | "URGENT_CARE"
  | "TELEHEALTH"
  | "OTHER"

export type AppointmentStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "RESCHEDULED"

export type AppointmentRow = {
  id: string
  memberId: string
  providerId: string | null
  appointmentDateTime: Date
  durationMinutes: number
  appointmentType: AppointmentType
  status: AppointmentStatus
  location: string | null
  reasonForVisit: string | null
  memberFirstName: string
  memberLastName: string
  providerName: string | null
}

export type AppointmentInput = {
  providerId: string | null
  appointmentDateTime: Date
  durationMinutes: number
  appointmentType: AppointmentType
  location: string | null
  reasonForVisit: string | null
}

export async function listAppointments(
  householdId: string,
  memberId: string | null
): Promise<Array<AppointmentRow>> {
  return sql<Array<AppointmentRow>>`
    SELECT a."id", a."memberId", a."providerId", a."appointmentDateTime",
           a."durationMinutes", a."appointmentType"::text AS "appointmentType",
           a."status"::text AS "status", a."location", a."reasonForVisit",
           hm."firstName" AS "memberFirstName",
           hm."lastName" AS "memberLastName",
           p."name" AS "providerName"
    FROM "Appointment" a
    JOIN "HealthMember" hm ON hm."id" = a."memberId"
    LEFT JOIN "Provider" p ON p."id" = a."providerId"
    WHERE hm."householdId" = ${householdId}
      AND (${memberId}::uuid IS NULL OR a."memberId" = ${memberId}::uuid)
    ORDER BY a."appointmentDateTime" DESC
    LIMIT 50`
}

// Caller re-verifies member + provider ownership first.
export async function createAppointment(
  memberId: string,
  input: AppointmentInput
): Promise<void> {
  await sql`
    INSERT INTO "Appointment" (
      "memberId", "providerId", "appointmentDateTime", "durationMinutes",
      "appointmentType", "location", "reasonForVisit"
    ) VALUES (
      ${memberId}, ${input.providerId}, ${input.appointmentDateTime},
      ${input.durationMinutes}, ${input.appointmentType}::"AppointmentType",
      ${input.location}, ${input.reasonForVisit}
    )`
}

export async function updateAppointmentStatus(
  householdId: string,
  id: string,
  status: AppointmentStatus
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Appointment" a
    SET "status" = ${status}::"AppointmentStatus", "updatedAt" = now()
    FROM "HealthMember" hm
    WHERE a."id" = ${id} AND hm."id" = a."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING a."id"`
  return rows.length > 0
}

export async function deleteAppointment(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Appointment" a
    USING "HealthMember" hm
    WHERE a."id" = ${id} AND hm."id" = a."memberId"
      AND hm."householdId" = ${householdId}
    RETURNING a."id"`
  return rows.length > 0
}

// Household-scoped lookup used when linking a visit summary to an
// appointment: returns the owning memberId so the caller can verify the
// appointment belongs to the visit's member.
export async function getAppointmentMemberId(
  householdId: string,
  appointmentId: string
): Promise<string | null> {
  const rows = await sql<Array<{ memberId: string }>>`
    SELECT a."memberId"
    FROM "Appointment" a
    JOIN "HealthMember" hm ON hm."id" = a."memberId"
    WHERE a."id" = ${appointmentId} AND hm."householdId" = ${householdId}`
  return rows[0]?.memberId ?? null
}
