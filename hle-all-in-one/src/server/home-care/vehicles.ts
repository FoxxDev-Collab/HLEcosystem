import { sql } from "@/server/db"

export type VehicleStatus = "ACTIVE" | "SOLD" | "SCRAPPED" | "STORED"

export type VehicleRow = {
  id: string
  year: number | null
  make: string
  model: string
  trim: string | null
  vin: string | null
  licensePlate: string | null
  color: string | null
  currentMileage: number | null
  mileageAsOf: string | null
  purchaseDate: string | null
  purchasePrice: number | null
  purchasedFrom: string | null
  status: VehicleStatus
  notes: string | null
}

export type VehicleOption = {
  id: string
  year: number | null
  make: string
  model: string
}

export type VehicleMaintenanceLogRow = {
  id: string
  title: string
  completedDate: string
  completedBy: string | null
  mileageAtService: number | null
  cost: number | null
  notes: string | null
}

export type VehicleRepairRow = {
  id: string
  title: string
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  reportedDate: string
  completedBy: string | null
  providerName: string | null
  totalCost: number | null
}

export type VehicleDocumentRow = {
  id: string
  name: string
  type: "MANUAL" | "WARRANTY" | "RECEIPT" | "INVOICE" | "PHOTO" | "OTHER"
}

export type VehicleInput = {
  year: number | null
  make: string
  model: string
  trim: string | null
  vin: string | null
  licensePlate: string | null
  color: string | null
  currentMileage: number | null
  purchaseDate: string | null
  purchasePrice: number | null
  purchasedFrom: string | null
  notes: string | null
}

export async function listVehicles(
  householdId: string
): Promise<Array<VehicleRow>> {
  return sql<Array<VehicleRow>>`
    SELECT "id", "year", "make", "model", "trim", "vin", "licensePlate",
           "color", "currentMileage", "mileageAsOf"::text,
           "purchaseDate"::text, "purchasePrice"::float8, "purchasedFrom",
           "status", "notes"
    FROM "Vehicle"
    WHERE "householdId" = ${householdId} AND NOT "isArchived"
    ORDER BY "status" ASC, "year" DESC NULLS LAST`
}

// Vehicle picker for the mileage log — active, non-archived only (legacy).
export async function listActiveVehicleOptions(
  householdId: string
): Promise<Array<VehicleOption>> {
  return sql<Array<VehicleOption>>`
    SELECT "id", "year", "make", "model"
    FROM "Vehicle"
    WHERE "householdId" = ${householdId} AND NOT "isArchived"
      AND "status" = 'ACTIVE'
    ORDER BY "make" ASC`
}

export async function getVehicle(
  householdId: string,
  id: string
): Promise<VehicleRow | null> {
  const rows = await sql<Array<VehicleRow>>`
    SELECT "id", "year", "make", "model", "trim", "vin", "licensePlate",
           "color", "currentMileage", "mileageAsOf"::text,
           "purchaseDate"::text, "purchasePrice"::float8, "purchasedFrom",
           "status", "notes"
    FROM "Vehicle"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

export async function createVehicle(
  householdId: string,
  input: VehicleInput
): Promise<string> {
  // mileageAsOf is stamped today when an initial reading is given (legacy).
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Vehicle" (
      "householdId", "year", "make", "model", "trim", "vin", "licensePlate",
      "color", "currentMileage", "mileageAsOf", "purchaseDate",
      "purchasePrice", "purchasedFrom", "notes"
    ) VALUES (
      ${householdId}, ${input.year}, ${input.make}, ${input.model},
      ${input.trim}, ${input.vin}, ${input.licensePlate}, ${input.color},
      ${input.currentMileage},
      CASE WHEN ${input.currentMileage}::int IS NULL
           THEN NULL ELSE CURRENT_DATE END,
      ${input.purchaseDate}, ${input.purchasePrice}, ${input.purchasedFrom},
      ${input.notes}
    ) RETURNING "id"`
  return rows[0].id
}

export async function updateVehicle(
  householdId: string,
  id: string,
  input: VehicleInput,
  status: VehicleStatus
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Vehicle" SET
      "year" = ${input.year},
      "make" = ${input.make},
      "model" = ${input.model},
      "trim" = ${input.trim},
      "vin" = ${input.vin},
      "licensePlate" = ${input.licensePlate},
      "color" = ${input.color},
      "currentMileage" = ${input.currentMileage},
      "purchaseDate" = ${input.purchaseDate},
      "purchasePrice" = ${input.purchasePrice},
      "purchasedFrom" = ${input.purchasedFrom},
      "status" = ${status}::"VehicleStatus",
      "notes" = ${input.notes},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteVehicle(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Vehicle"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function listMaintenanceLogsForVehicle(
  householdId: string,
  vehicleId: string
): Promise<Array<VehicleMaintenanceLogRow>> {
  return sql<Array<VehicleMaintenanceLogRow>>`
    SELECT "id", "title", "completedDate"::text, "completedBy",
           "mileageAtService", "cost"::float8, "notes"
    FROM "MaintenanceLog"
    WHERE "householdId" = ${householdId} AND "vehicleId" = ${vehicleId}
    ORDER BY "completedDate" DESC
    LIMIT 10`
}

export async function listRepairsForVehicle(
  householdId: string,
  vehicleId: string
): Promise<Array<VehicleRepairRow>> {
  return sql<Array<VehicleRepairRow>>`
    SELECT rep."id", rep."title", rep."status", rep."reportedDate"::text,
           rep."completedBy", p."name" AS "providerName",
           rep."totalCost"::float8
    FROM "Repair" rep
    LEFT JOIN "ServiceProvider" p ON p."id" = rep."providerId"
    WHERE rep."householdId" = ${householdId}
      AND rep."vehicleId" = ${vehicleId}
    ORDER BY rep."reportedDate" DESC
    LIMIT 10`
}

export async function listDocumentsForVehicle(
  householdId: string,
  vehicleId: string
): Promise<Array<VehicleDocumentRow>> {
  return sql<Array<VehicleDocumentRow>>`
    SELECT "id", "name", "type"
    FROM "Document"
    WHERE "householdId" = ${householdId} AND "vehicleId" = ${vehicleId}
    ORDER BY "createdAt" DESC`
}
