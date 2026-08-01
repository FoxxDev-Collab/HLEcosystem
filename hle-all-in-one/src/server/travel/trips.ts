import { sql } from "@/server/db"

export type TripStatus =
  "PLANNING" | "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export type TripRow = {
  id: string
  name: string
  description: string | null
  destination: string | null
  startDate: string
  endDate: string
  status: TripStatus
  coverImageUrl: string | null
  notes: string | null
  createdAt: Date
}

export type TripListRow = TripRow & {
  travelerCount: number
  reservationCount: number
}

export type TripInput = {
  name: string
  destination: string | null
  startDate: string
  endDate: string
  description: string | null
  notes: string | null
}

// Legacy syncTripStatusesAction: trips roll forward automatically — a
// PLANNING/BOOKED trip whose window includes today becomes IN_PROGRESS, and
// any non-cancelled trip whose end date has passed becomes COMPLETED.
export async function syncTripStatuses(householdId: string): Promise<void> {
  await sql`
    UPDATE "Trip"
    SET "status" = 'IN_PROGRESS', "updatedAt" = now()
    WHERE "householdId" = ${householdId}
      AND "status" IN ('PLANNING', 'BOOKED')
      AND "startDate" <= CURRENT_DATE AND "endDate" >= CURRENT_DATE`
  await sql`
    UPDATE "Trip"
    SET "status" = 'COMPLETED', "updatedAt" = now()
    WHERE "householdId" = ${householdId}
      AND "status" IN ('PLANNING', 'BOOKED', 'IN_PROGRESS')
      AND "endDate" < CURRENT_DATE`
}

export async function listTrips(
  householdId: string,
  status: TripStatus | null
): Promise<Array<TripListRow>> {
  if (status) {
    return sql<Array<TripListRow>>`
      SELECT t."id", t."name", t."description", t."destination",
             t."startDate"::text, t."endDate"::text, t."status",
             t."coverImageUrl", t."notes", t."createdAt",
             (SELECT count(*)::int FROM "Traveler" tr WHERE tr."tripId" = t."id") AS "travelerCount",
             (SELECT count(*)::int FROM "Reservation" r WHERE r."tripId" = t."id") AS "reservationCount"
      FROM "Trip" t
      WHERE t."householdId" = ${householdId}
        AND t."status" = ${status}::"TripStatus"
      ORDER BY t."startDate" DESC`
  }
  return sql<Array<TripListRow>>`
    SELECT t."id", t."name", t."description", t."destination",
           t."startDate"::text, t."endDate"::text, t."status",
           t."coverImageUrl", t."notes", t."createdAt",
           (SELECT count(*)::int FROM "Traveler" tr WHERE tr."tripId" = t."id") AS "travelerCount",
           (SELECT count(*)::int FROM "Reservation" r WHERE r."tripId" = t."id") AS "reservationCount"
    FROM "Trip" t
    WHERE t."householdId" = ${householdId}
    ORDER BY t."startDate" DESC`
}

export async function createTrip(
  householdId: string,
  input: TripInput
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Trip" (
      "householdId", "name", "destination", "startDate", "endDate",
      "description", "notes"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.destination}, ${input.startDate},
      ${input.endDate}, ${input.description}, ${input.notes}
    ) RETURNING "id"`
  return rows[0].id
}

export async function updateTrip(
  householdId: string,
  id: string,
  input: TripInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Trip" SET
      "name" = ${input.name},
      "destination" = ${input.destination},
      "startDate" = ${input.startDate},
      "endDate" = ${input.endDate},
      "description" = ${input.description},
      "notes" = ${input.notes},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function updateTripStatus(
  householdId: string,
  id: string,
  status: TripStatus
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Trip"
    SET "status" = ${status}::"TripStatus", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteTrip(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Trip"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Ownership re-check before mutating child rows by trip id (ADR-0005).
export async function tripBelongsToHousehold(
  householdId: string,
  tripId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Trip"
    WHERE "id" = ${tripId} AND "householdId" = ${householdId}`
  return rows.length > 0
}
