import { sql } from "@/server/db"

export type MaintenanceFrequency =
  | "WEEKLY"
  | "BI_WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMI_ANNUALLY"
  | "ANNUALLY"
  | "CUSTOM_DAYS"

export type ScheduleRow = {
  id: string
  itemId: string | null
  vehicleId: string | null
  title: string
  description: string | null
  frequency: MaintenanceFrequency
  customIntervalDays: number | null
  lastCompletedDate: string | null
  nextDueDate: string | null
  estimatedCost: number | null
  assignedTo: string | null
  isActive: boolean
  itemName: string | null
  vehicleYear: number | null
  vehicleMake: string | null
  vehicleModel: string | null
}

// Small read-only pickers for the Item / Vehicle dropdowns. The items and
// vehicles features themselves live in src/server/home-care/items.ts and
// vehicles.ts (owned elsewhere) — these queries are intentionally local.
export type ItemOption = { id: string; name: string }

export type VehicleOption = {
  id: string
  year: number | null
  make: string
  model: string
}

export async function listItemOptions(
  householdId: string
): Promise<Array<ItemOption>> {
  return sql<Array<ItemOption>>`
    SELECT "id", "name"
    FROM "Item"
    WHERE "householdId" = ${householdId} AND "isArchived" = false
    ORDER BY "name" ASC`
}

export async function listVehicleOptions(
  householdId: string
): Promise<Array<VehicleOption>> {
  return sql<Array<VehicleOption>>`
    SELECT "id", "year", "make", "model"
    FROM "Vehicle"
    WHERE "householdId" = ${householdId} AND "isArchived" = false
    ORDER BY "make" ASC, "model" ASC`
}

export function vehicleLabel(v: {
  year: number | null
  make: string
  model: string
}): string {
  return `${v.year ? `${v.year} ` : ""}${v.make} ${v.model}`
}

export async function listSchedules(
  householdId: string
): Promise<Array<ScheduleRow>> {
  return sql<Array<ScheduleRow>>`
    SELECT s."id", s."itemId", s."vehicleId", s."title", s."description",
           s."frequency", s."customIntervalDays",
           s."lastCompletedDate"::text, s."nextDueDate"::text,
           s."estimatedCost"::float8, s."assignedTo", s."isActive",
           i."name" AS "itemName",
           v."year" AS "vehicleYear", v."make" AS "vehicleMake",
           v."model" AS "vehicleModel"
    FROM "MaintenanceSchedule" s
    LEFT JOIN "Item" i ON i."id" = s."itemId"
    LEFT JOIN "Vehicle" v ON v."id" = s."vehicleId"
    WHERE s."householdId" = ${householdId}
    ORDER BY s."isActive" DESC, s."nextDueDate" ASC NULLS LAST`
}

export type ScheduleInput = {
  title: string
  description: string | null
  itemId: string | null
  vehicleId: string | null
  frequency: MaintenanceFrequency
  customIntervalDays: number | null
  nextDueDate: string | null
  estimatedCost: number | null
  assignedTo: string | null
}

// Foreign ids from form data are re-scoped via subselects: an id that does
// not belong to this household resolves to NULL instead of linking
// cross-tenant (ADR-0005).
export async function createSchedule(
  householdId: string,
  input: ScheduleInput
): Promise<void> {
  await sql`
    INSERT INTO "MaintenanceSchedule" (
      "householdId", "itemId", "vehicleId", "title", "description",
      "frequency", "customIntervalDays", "nextDueDate", "estimatedCost",
      "assignedTo"
    ) VALUES (
      ${householdId},
      (SELECT "id" FROM "Item"
       WHERE "id" = ${input.itemId} AND "householdId" = ${householdId}),
      (SELECT "id" FROM "Vehicle"
       WHERE "id" = ${input.vehicleId} AND "householdId" = ${householdId}),
      ${input.title}, ${input.description},
      ${input.frequency}::"MaintenanceFrequency", ${input.customIntervalDays},
      ${input.nextDueDate}, ${input.estimatedCost}, ${input.assignedTo}
    )`
}

export async function updateSchedule(
  householdId: string,
  id: string,
  input: ScheduleInput & { isActive: boolean }
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "MaintenanceSchedule" SET
      "title" = ${input.title},
      "description" = ${input.description},
      "itemId" = (SELECT "id" FROM "Item"
                  WHERE "id" = ${input.itemId} AND "householdId" = ${householdId}),
      "vehicleId" = (SELECT "id" FROM "Vehicle"
                     WHERE "id" = ${input.vehicleId} AND "householdId" = ${householdId}),
      "frequency" = ${input.frequency}::"MaintenanceFrequency",
      "customIntervalDays" = ${input.customIntervalDays},
      "nextDueDate" = ${input.nextDueDate},
      "estimatedCost" = ${input.estimatedCost},
      "assignedTo" = ${input.assignedTo},
      "isActive" = ${input.isActive},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteSchedule(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "MaintenanceSchedule"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Advances a due date by one frequency interval (legacy computeNextDueDate).
// Operates on local-time dates so the day never shifts across timezones.
export function computeNextDueDate(
  fromDate: string,
  frequency: MaintenanceFrequency,
  customDays: number | null
): string {
  const [y, m, d] = fromDate.split("-").map(Number)
  const next = new Date(y, m - 1, d)
  switch (frequency) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7)
      break
    case "BI_WEEKLY":
      next.setDate(next.getDate() + 14)
      break
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1)
      break
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3)
      break
    case "SEMI_ANNUALLY":
      next.setMonth(next.getMonth() + 6)
      break
    case "ANNUALLY":
      next.setFullYear(next.getFullYear() + 1)
      break
    case "CUSTOM_DAYS":
      next.setDate(next.getDate() + (customDays ?? 30))
      break
  }
  const yy = next.getFullYear()
  const mm = String(next.getMonth() + 1).padStart(2, "0")
  const dd = String(next.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

export type CompleteScheduleInput = {
  completedDate: string
  completedBy: string | null
  cost: number | null
  mileageAtService: number | null
  notes: string | null
}

// Legacy completeScheduleAction: log a COMPLETED MaintenanceLog entry, advance
// lastCompletedDate/nextDueDate by the schedule's frequency, and — for vehicle
// schedules with a reported odometer reading higher than the vehicle's current
// mileage — bump Vehicle.currentMileage / mileageAsOf.
export async function completeSchedule(
  householdId: string,
  scheduleId: string,
  input: CompleteScheduleInput
): Promise<boolean> {
  const schedules = await sql<
    Array<{
      id: string
      itemId: string | null
      vehicleId: string | null
      title: string
      frequency: MaintenanceFrequency
      customIntervalDays: number | null
    }>
  >`
    SELECT "id", "itemId", "vehicleId", "title", "frequency",
           "customIntervalDays"
    FROM "MaintenanceSchedule"
    WHERE "id" = ${scheduleId} AND "householdId" = ${householdId}`
  const schedule = schedules[0]
  if (!schedule) return false

  await sql`
    INSERT INTO "MaintenanceLog" (
      "householdId", "maintenanceScheduleId", "itemId", "vehicleId", "title",
      "completedDate", "completedBy", "status", "cost", "mileageAtService",
      "notes"
    ) VALUES (
      ${householdId}, ${schedule.id}, ${schedule.itemId}, ${schedule.vehicleId},
      ${schedule.title}, ${input.completedDate}, ${input.completedBy},
      'COMPLETED', ${input.cost}, ${input.mileageAtService}, ${input.notes}
    )`

  const nextDueDate = computeNextDueDate(
    input.completedDate,
    schedule.frequency,
    schedule.customIntervalDays
  )
  await sql`
    UPDATE "MaintenanceSchedule"
    SET "lastCompletedDate" = ${input.completedDate},
        "nextDueDate" = ${nextDueDate},
        "updatedAt" = now()
    WHERE "id" = ${schedule.id} AND "householdId" = ${householdId}`

  if (schedule.vehicleId && input.mileageAtService) {
    await sql`
      UPDATE "Vehicle"
      SET "currentMileage" = ${input.mileageAtService},
          "mileageAsOf" = ${input.completedDate},
          "updatedAt" = now()
      WHERE "id" = ${schedule.vehicleId} AND "householdId" = ${householdId}
        AND ("currentMileage" IS NULL
             OR "currentMileage" < ${input.mileageAtService})`
  }

  return true
}
