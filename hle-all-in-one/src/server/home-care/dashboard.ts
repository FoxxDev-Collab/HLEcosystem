import { sql } from "@/server/db"
import type { MaintenanceStatus } from "./maintenance-logs"
import type { RepairStatus } from "./repairs"

// Read-only aggregates for the home-care dashboard and calendar. Items and
// vehicles are owned by their own features — only counted/listed here.

function countOne(rows: Array<{ count: number }>): number {
  return rows[0]?.count ?? 0
}

export async function getActiveItemCount(householdId: string): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "Item"
      WHERE "householdId" = ${householdId} AND "isArchived" = false`
  )
}

export async function getActiveVehicleCount(
  householdId: string
): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "Vehicle"
      WHERE "householdId" = ${householdId} AND "isArchived" = false`
  )
}

export async function getOverdueScheduleCount(
  householdId: string
): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "MaintenanceSchedule"
      WHERE "householdId" = ${householdId} AND "isActive" = true
        AND "nextDueDate" < CURRENT_DATE`
  )
}

export async function getActiveRepairCount(
  householdId: string
): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "Repair"
      WHERE "householdId" = ${householdId}
        AND "status" IN ('SCHEDULED', 'IN_PROGRESS')`
  )
}

export type DueScheduleRow = {
  id: string
  title: string
  nextDueDate: string
  itemName: string | null
  vehicleYear: number | null
  vehicleMake: string | null
  vehicleModel: string | null
}

export async function listSchedulesDueThisWeek(
  householdId: string
): Promise<Array<DueScheduleRow>> {
  return sql<Array<DueScheduleRow>>`
    SELECT s."id", s."title", s."nextDueDate"::text,
           i."name" AS "itemName",
           v."year" AS "vehicleYear", v."make" AS "vehicleMake",
           v."model" AS "vehicleModel"
    FROM "MaintenanceSchedule" s
    LEFT JOIN "Item" i ON i."id" = s."itemId"
    LEFT JOIN "Vehicle" v ON v."id" = s."vehicleId"
    WHERE s."householdId" = ${householdId} AND s."isActive" = true
      AND s."nextDueDate" >= CURRENT_DATE
      AND s."nextDueDate" <= CURRENT_DATE + 7
    ORDER BY s."nextDueDate" ASC`
}

export type ExpiringWarrantyRow = {
  id: string
  name: string
  warrantyExpires: string
}

export async function listExpiringWarranties(
  householdId: string
): Promise<Array<ExpiringWarrantyRow>> {
  return sql<Array<ExpiringWarrantyRow>>`
    SELECT "id", "name", "warrantyExpires"::text
    FROM "Item"
    WHERE "householdId" = ${householdId} AND "isArchived" = false
      AND "warrantyExpires" > CURRENT_DATE
      AND "warrantyExpires" <= CURRENT_DATE + 30
    ORDER BY "warrantyExpires" ASC`
}

export type RecentLogRow = {
  id: string
  title: string
  completedDate: string
  completedBy: string | null
  cost: number | null
  status: MaintenanceStatus
  itemName: string | null
  vehicleMake: string | null
  vehicleModel: string | null
}

export async function listRecentMaintenanceLogs(
  householdId: string
): Promise<Array<RecentLogRow>> {
  return sql<Array<RecentLogRow>>`
    SELECT l."id", l."title", l."completedDate"::text, l."completedBy",
           l."cost"::float8, l."status",
           i."name" AS "itemName",
           v."make" AS "vehicleMake", v."model" AS "vehicleModel"
    FROM "MaintenanceLog" l
    LEFT JOIN "Item" i ON i."id" = l."itemId"
    LEFT JOIN "Vehicle" v ON v."id" = l."vehicleId"
    WHERE l."householdId" = ${householdId}
    ORDER BY l."completedDate" DESC
    LIMIT 5`
}

export type RecentRepairRow = {
  id: string
  title: string
  reportedDate: string
  status: RepairStatus
  totalCost: number | null
  providerName: string | null
}

export async function listRecentRepairs(
  householdId: string
): Promise<Array<RecentRepairRow>> {
  return sql<Array<RecentRepairRow>>`
    SELECT r."id", r."title", r."reportedDate"::text, r."status",
           r."totalCost"::float8,
           p."name" AS "providerName"
    FROM "Repair" r
    LEFT JOIN "ServiceProvider" p ON p."id" = r."providerId"
    WHERE r."householdId" = ${householdId}
    ORDER BY r."reportedDate" DESC
    LIMIT 5`
}

// ─── Calendar (legacy lib/calendar.ts) ──────────────────────────────────────

export type CalendarEventKind = "maintenance" | "repair" | "warranty"

export type CalendarEventRow = {
  id: string
  date: string // "YYYY-MM-DD"
  title: string
  kind: CalendarEventKind
  entityName: string | null
  itemId: string | null // set for warranty events → links to the item page
}

function vehicleName(v: {
  vehicleYear: number | null
  vehicleMake: string | null
  vehicleModel: string | null
}): string | null {
  if (!v.vehicleMake || !v.vehicleModel) return null
  return `${v.vehicleYear ? `${v.vehicleYear} ` : ""}${v.vehicleMake} ${v.vehicleModel}`
}

export async function getCalendarEvents(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<Array<CalendarEventRow>> {
  const [schedules, repairs, warranties] = await Promise.all([
    sql<
      Array<{
        id: string
        title: string
        nextDueDate: string
        itemName: string | null
        vehicleYear: number | null
        vehicleMake: string | null
        vehicleModel: string | null
      }>
    >`
      SELECT s."id", s."title", s."nextDueDate"::text,
             i."name" AS "itemName",
             v."year" AS "vehicleYear", v."make" AS "vehicleMake",
             v."model" AS "vehicleModel"
      FROM "MaintenanceSchedule" s
      LEFT JOIN "Item" i ON i."id" = s."itemId"
      LEFT JOIN "Vehicle" v ON v."id" = s."vehicleId"
      WHERE s."householdId" = ${householdId} AND s."isActive" = true
        AND s."nextDueDate" >= ${startDate} AND s."nextDueDate" <= ${endDate}`,
    sql<
      Array<{
        id: string
        title: string
        scheduledDate: string
        itemName: string | null
        vehicleYear: number | null
        vehicleMake: string | null
        vehicleModel: string | null
      }>
    >`
      SELECT r."id", r."title", r."scheduledDate"::text,
             i."name" AS "itemName",
             v."year" AS "vehicleYear", v."make" AS "vehicleMake",
             v."model" AS "vehicleModel"
      FROM "Repair" r
      LEFT JOIN "Item" i ON i."id" = r."itemId"
      LEFT JOIN "Vehicle" v ON v."id" = r."vehicleId"
      WHERE r."householdId" = ${householdId}
        AND r."status" IN ('SCHEDULED', 'IN_PROGRESS')
        AND r."scheduledDate" >= ${startDate}
        AND r."scheduledDate" <= ${endDate}`,
    sql<Array<{ id: string; name: string; warrantyExpires: string }>>`
      SELECT "id", "name", "warrantyExpires"::text
      FROM "Item"
      WHERE "householdId" = ${householdId} AND "isArchived" = false
        AND "warrantyExpires" >= ${startDate}
        AND "warrantyExpires" <= ${endDate}`,
  ])

  const events: Array<CalendarEventRow> = []

  for (const s of schedules) {
    events.push({
      id: `schedule-${s.id}`,
      date: s.nextDueDate,
      title: s.title,
      kind: "maintenance",
      entityName: s.itemName || vehicleName(s),
      itemId: null,
    })
  }

  for (const r of repairs) {
    events.push({
      id: `repair-${r.id}`,
      date: r.scheduledDate,
      title: r.title,
      kind: "repair",
      entityName: r.itemName || vehicleName(r),
      itemId: null,
    })
  }

  for (const item of warranties) {
    events.push({
      id: `warranty-${item.id}`,
      date: item.warrantyExpires,
      title: `${item.name} warranty expires`,
      kind: "warranty",
      entityName: item.name,
      itemId: item.id,
    })
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}
