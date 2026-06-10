// Health dashboard aggregates (legacy dashboard/page.tsx). Medication and
// Vaccination reads here are display-only — their mutations belong to the
// medications module. Everything scopes through "HealthMember"."householdId".
import { sql } from "@/server/db"

export type DashboardMemberRow = {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  relationship: string | null
  hasProfile: boolean
}

export type DashboardAppointmentRow = {
  id: string
  appointmentType: string
  appointmentDateTime: Date
  location: string | null
  memberFirstName: string
  providerName: string | null
}

export type DashboardRefillRow = {
  id: string
  medicationName: string
  nextRefillDate: string | null
  refillsRemaining: number | null
  memberFirstName: string
}

export type DashboardVaccinationRow = {
  id: string
  vaccineName: string
  nextDoseDate: string
  memberFirstName: string
}

export type DashboardVisitRow = {
  id: string
  visitType: string
  visitDate: Date
  chiefComplaint: string | null
  memberFirstName: string
  providerName: string | null
}

// Active members with a "has a profile yet?" flag.
export async function listDashboardMembers(
  householdId: string
): Promise<Array<DashboardMemberRow>> {
  return sql<Array<DashboardMemberRow>>`
    SELECT hm."id", hm."firstName", hm."lastName", hm."dateOfBirth"::text,
           hm."relationship",
           EXISTS (SELECT 1 FROM "HealthProfileRecord" p
                    WHERE p."memberId" = hm."id") AS "hasProfile"
    FROM "HealthMember" hm
    WHERE hm."householdId" = ${householdId} AND hm."isActive"
    ORDER BY hm."firstName" ASC, hm."lastName" ASC`
}

// Scheduled appointments in the next 30 days.
export async function listUpcomingAppointments(
  householdId: string
): Promise<Array<DashboardAppointmentRow>> {
  return sql<Array<DashboardAppointmentRow>>`
    SELECT a."id", a."appointmentType"::text AS "appointmentType",
           a."appointmentDateTime", a."location",
           hm."firstName" AS "memberFirstName", p."name" AS "providerName"
    FROM "Appointment" a
    JOIN "HealthMember" hm ON hm."id" = a."memberId"
    LEFT JOIN "Provider" p ON p."id" = a."providerId"
    WHERE hm."householdId" = ${householdId}
      AND a."status" = 'SCHEDULED'
      AND a."appointmentDateTime" >= now()
      AND a."appointmentDateTime" <= now() + interval '30 days'
    ORDER BY a."appointmentDateTime" ASC
    LIMIT 5`
}

export async function countActiveMedications(
  householdId: string
): Promise<number> {
  const [row] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count"
    FROM "Medication" md
    JOIN "HealthMember" hm ON hm."id" = md."memberId"
    WHERE hm."householdId" = ${householdId} AND md."isActive"`
  return row.count
}

// Active medications with a refill due within 7 days (or overdue).
export async function listRefillsDue(
  householdId: string
): Promise<Array<DashboardRefillRow>> {
  return sql<Array<DashboardRefillRow>>`
    SELECT md."id", md."medicationName", md."nextRefillDate"::text,
           md."refillsRemaining", hm."firstName" AS "memberFirstName"
    FROM "Medication" md
    JOIN "HealthMember" hm ON hm."id" = md."memberId"
    WHERE hm."householdId" = ${householdId}
      AND md."isActive"
      AND md."nextRefillDate" <= CURRENT_DATE + 7
    ORDER BY md."nextRefillDate" ASC`
}

// Next doses due within 30 days.
export async function listUpcomingVaccinations(
  householdId: string
): Promise<Array<DashboardVaccinationRow>> {
  return sql<Array<DashboardVaccinationRow>>`
    SELECT v."id", v."vaccineName", v."nextDoseDate"::text,
           hm."firstName" AS "memberFirstName"
    FROM "Vaccination" v
    JOIN "HealthMember" hm ON hm."id" = v."memberId"
    WHERE hm."householdId" = ${householdId}
      AND v."nextDoseDate" >= CURRENT_DATE
      AND v."nextDoseDate" <= CURRENT_DATE + 30
    ORDER BY v."nextDoseDate" ASC
    LIMIT 5`
}

export async function listRecentVisits(
  householdId: string
): Promise<Array<DashboardVisitRow>> {
  return sql<Array<DashboardVisitRow>>`
    SELECT v."id", v."visitType"::text AS "visitType", v."visitDate",
           v."chiefComplaint", hm."firstName" AS "memberFirstName",
           p."name" AS "providerName"
    FROM "VisitSummary" v
    JOIN "HealthMember" hm ON hm."id" = v."memberId"
    LEFT JOIN "Provider" p ON p."id" = v."providerId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY v."visitDate" DESC
    LIMIT 5`
}
