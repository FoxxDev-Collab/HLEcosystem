import { sql } from "@/server/db"

export type MaintenanceStatus = "PENDING" | "COMPLETED" | "SKIPPED" | "OVERDUE"

export type MaintenanceLogRow = {
  id: string
  maintenanceScheduleId: string | null
  itemId: string | null
  vehicleId: string | null
  title: string
  description: string | null
  completedDate: string
  completedBy: string | null
  status: MaintenanceStatus
  cost: number | null
  mileageAtService: number | null
  partsUsed: string | null
  notes: string | null
  itemName: string | null
  vehicleYear: number | null
  vehicleMake: string | null
  vehicleModel: string | null
}

// Optional item/vehicle filters mirror the legacy page's search params
// (linked from item/vehicle detail pages). NULL filter matches everything.
export async function listMaintenanceLogs(
  householdId: string,
  itemId: string | null,
  vehicleId: string | null
): Promise<Array<MaintenanceLogRow>> {
  return sql<Array<MaintenanceLogRow>>`
    SELECT l."id", l."maintenanceScheduleId", l."itemId", l."vehicleId",
           l."title", l."description", l."completedDate"::text,
           l."completedBy", l."status", l."cost"::float8,
           l."mileageAtService", l."partsUsed", l."notes",
           i."name" AS "itemName",
           v."year" AS "vehicleYear", v."make" AS "vehicleMake",
           v."model" AS "vehicleModel"
    FROM "MaintenanceLog" l
    LEFT JOIN "Item" i ON i."id" = l."itemId"
    LEFT JOIN "Vehicle" v ON v."id" = l."vehicleId"
    WHERE l."householdId" = ${householdId}
      AND (${itemId}::uuid IS NULL OR l."itemId" = ${itemId}::uuid)
      AND (${vehicleId}::uuid IS NULL OR l."vehicleId" = ${vehicleId}::uuid)
    ORDER BY l."completedDate" DESC
    LIMIT 100`
}

export type MaintenanceLogInput = {
  title: string
  description: string | null
  itemId: string | null
  vehicleId: string | null
  completedDate: string
  completedBy: string | null
  cost: number | null
  mileageAtService: number | null
  partsUsed: string | null
  notes: string | null
}

// Foreign ids are re-scoped via subselects — a cross-household id resolves
// to NULL instead of linking another tenant's row (ADR-0005).
export async function createMaintenanceLog(
  householdId: string,
  input: MaintenanceLogInput
): Promise<void> {
  await sql`
    INSERT INTO "MaintenanceLog" (
      "householdId", "title", "description", "itemId", "vehicleId",
      "completedDate", "completedBy", "cost", "mileageAtService",
      "partsUsed", "notes"
    ) VALUES (
      ${householdId}, ${input.title}, ${input.description},
      (SELECT "id" FROM "Item"
       WHERE "id" = ${input.itemId} AND "householdId" = ${householdId}),
      (SELECT "id" FROM "Vehicle"
       WHERE "id" = ${input.vehicleId} AND "householdId" = ${householdId}),
      ${input.completedDate}, ${input.completedBy}, ${input.cost},
      ${input.mileageAtService}, ${input.partsUsed}, ${input.notes}
    )`
}

export async function deleteMaintenanceLog(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "MaintenanceLog"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}
