import { sql } from "@/server/db"

// "MileageEntry" has no householdId of its own — every query here scopes
// through the parent "Vehicle" (PORTING.md invariant 2).

export type MileageEntryRow = {
  id: string
  vehicleId: string
  mileage: number
  date: string
  notes: string | null
  vehicleYear: number | null
  vehicleMake: string
  vehicleModel: string
}

export type VehicleMileageEntryRow = {
  id: string
  mileage: number
  date: string
  notes: string | null
}

export async function listRecentMileageEntries(
  householdId: string
): Promise<Array<MileageEntryRow>> {
  return sql<Array<MileageEntryRow>>`
    SELECT e."id", e."vehicleId", e."mileage", e."date"::text, e."notes",
           v."year" AS "vehicleYear", v."make" AS "vehicleMake",
           v."model" AS "vehicleModel"
    FROM "MileageEntry" e
    JOIN "Vehicle" v ON v."id" = e."vehicleId"
    WHERE v."householdId" = ${householdId}
    ORDER BY e."date" DESC
    LIMIT 50`
}

export async function listMileageEntriesForVehicle(
  householdId: string,
  vehicleId: string
): Promise<Array<VehicleMileageEntryRow>> {
  return sql<Array<VehicleMileageEntryRow>>`
    SELECT e."id", e."mileage", e."date"::text, e."notes"
    FROM "MileageEntry" e
    JOIN "Vehicle" v ON v."id" = e."vehicleId"
    WHERE e."vehicleId" = ${vehicleId} AND v."householdId" = ${householdId}
    ORDER BY e."date" DESC
    LIMIT 20`
}

// Verifies vehicle ownership first, then logs the entry and — when this is
// the highest reading so far — bumps the vehicle's currentMileage and
// mileageAsOf (legacy rule, mirrored exactly: a missing or zero
// currentMileage always gets replaced).
export async function createMileageEntry(
  householdId: string,
  vehicleId: string,
  mileage: number,
  date: string,
  notes: string | null
): Promise<boolean> {
  const vehicles = await sql<
    Array<{ id: string; currentMileage: number | null }>
  >`
    SELECT "id", "currentMileage"
    FROM "Vehicle"
    WHERE "id" = ${vehicleId} AND "householdId" = ${householdId}`
  const vehicle = vehicles[0]
  if (!vehicle) return false

  await sql`
    INSERT INTO "MileageEntry" ("vehicleId", "mileage", "date", "notes")
    VALUES (${vehicleId}, ${mileage}, ${date}, ${notes})`

  if (!vehicle.currentMileage || mileage > vehicle.currentMileage) {
    await sql`
      UPDATE "Vehicle"
      SET "currentMileage" = ${mileage}, "mileageAsOf" = ${date},
          "updatedAt" = now()
      WHERE "id" = ${vehicleId} AND "householdId" = ${householdId}`
  }
  return true
}

export async function deleteMileageEntry(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "MileageEntry" e
    USING "Vehicle" v
    WHERE e."id" = ${id} AND v."id" = e."vehicleId"
      AND v."householdId" = ${householdId}
    RETURNING e."id"`
  return rows.length > 0
}
