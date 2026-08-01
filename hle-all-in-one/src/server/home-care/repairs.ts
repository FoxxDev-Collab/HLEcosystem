import { sql } from "@/server/db"

export type RepairStatus =
  "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export type RepairRow = {
  id: string
  itemId: string | null
  vehicleId: string | null
  providerId: string | null
  title: string
  description: string | null
  status: RepairStatus
  reportedDate: string
  scheduledDate: string | null
  completedDate: string | null
  completedBy: string | null
  laborCost: number | null
  partsCost: number | null
  totalCost: number | null
  warrantyClaimId: string | null
  partsUsed: string | null
  notes: string | null
  itemName: string | null
  vehicleYear: number | null
  vehicleMake: string | null
  vehicleModel: string | null
  providerName: string | null
}

export type ProviderOption = {
  id: string
  name: string
  company: string | null
}

export async function listProviderOptions(
  householdId: string
): Promise<Array<ProviderOption>> {
  return sql<Array<ProviderOption>>`
    SELECT "id", "name", "company"
    FROM "ServiceProvider"
    WHERE "householdId" = ${householdId} AND "isActive" = true
    ORDER BY "name" ASC`
}

export async function listRepairs(
  householdId: string
): Promise<Array<RepairRow>> {
  return sql<Array<RepairRow>>`
    SELECT r."id", r."itemId", r."vehicleId", r."providerId", r."title",
           r."description", r."status", r."reportedDate"::text,
           r."scheduledDate"::text, r."completedDate"::text, r."completedBy",
           r."laborCost"::float8, r."partsCost"::float8, r."totalCost"::float8,
           r."warrantyClaimId", r."partsUsed", r."notes",
           i."name" AS "itemName",
           v."year" AS "vehicleYear", v."make" AS "vehicleMake",
           v."model" AS "vehicleModel",
           p."name" AS "providerName"
    FROM "Repair" r
    LEFT JOIN "Item" i ON i."id" = r."itemId"
    LEFT JOIN "Vehicle" v ON v."id" = r."vehicleId"
    LEFT JOIN "ServiceProvider" p ON p."id" = r."providerId"
    WHERE r."householdId" = ${householdId}
    ORDER BY r."reportedDate" DESC
    LIMIT 50`
}

export type RepairInput = {
  title: string
  description: string | null
  itemId: string | null
  vehicleId: string | null
  providerId: string | null
  reportedDate: string
  scheduledDate: string | null
  completedBy: string | null
  laborCost: number | null
  partsCost: number | null
  warrantyClaimId: string | null
  partsUsed: string | null
  notes: string | null
}

// totalCost is computed server-side: laborCost + partsCost, NULL when both
// are empty (legacy rule — never trust a client-computed total).
function computeTotalCost(
  laborCost: number | null,
  partsCost: number | null
): number | null {
  return (laborCost || 0) + (partsCost || 0) || null
}

// Foreign ids are re-scoped via subselects — a cross-household id resolves
// to NULL instead of linking another tenant's row (ADR-0005).
export async function createRepair(
  householdId: string,
  input: RepairInput
): Promise<void> {
  const totalCost = computeTotalCost(input.laborCost, input.partsCost)
  await sql`
    INSERT INTO "Repair" (
      "householdId", "title", "description", "itemId", "vehicleId",
      "providerId", "reportedDate", "scheduledDate", "completedBy",
      "laborCost", "partsCost", "totalCost", "warrantyClaimId", "partsUsed",
      "notes"
    ) VALUES (
      ${householdId}, ${input.title}, ${input.description},
      (SELECT "id" FROM "Item"
       WHERE "id" = ${input.itemId} AND "householdId" = ${householdId}),
      (SELECT "id" FROM "Vehicle"
       WHERE "id" = ${input.vehicleId} AND "householdId" = ${householdId}),
      (SELECT "id" FROM "ServiceProvider"
       WHERE "id" = ${input.providerId} AND "householdId" = ${householdId}),
      ${input.reportedDate}, ${input.scheduledDate}, ${input.completedBy},
      ${input.laborCost}, ${input.partsCost}, ${totalCost},
      ${input.warrantyClaimId}, ${input.partsUsed}, ${input.notes}
    )`
}

// Status transition: moving to COMPLETED stamps completedDate = today
// (legacy used `new Date()` on a date column); other statuses leave it as-is.
export async function updateRepairStatus(
  householdId: string,
  id: string,
  status: RepairStatus
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Repair" SET
      "status" = ${status}::"RepairStatus",
      "completedDate" = CASE
        WHEN ${status} = 'COMPLETED' THEN CURRENT_DATE
        ELSE "completedDate"
      END,
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function updateRepair(
  householdId: string,
  id: string,
  input: RepairInput & {
    status: RepairStatus
    completedDate: string | null
  }
): Promise<boolean> {
  const totalCost = computeTotalCost(input.laborCost, input.partsCost)
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Repair" SET
      "title" = ${input.title},
      "description" = ${input.description},
      "itemId" = (SELECT "id" FROM "Item"
                  WHERE "id" = ${input.itemId} AND "householdId" = ${householdId}),
      "vehicleId" = (SELECT "id" FROM "Vehicle"
                     WHERE "id" = ${input.vehicleId} AND "householdId" = ${householdId}),
      "providerId" = (SELECT "id" FROM "ServiceProvider"
                      WHERE "id" = ${input.providerId} AND "householdId" = ${householdId}),
      "status" = ${input.status}::"RepairStatus",
      "reportedDate" = ${input.reportedDate},
      "scheduledDate" = ${input.scheduledDate},
      "completedDate" = ${input.completedDate},
      "completedBy" = ${input.completedBy},
      "laborCost" = ${input.laborCost},
      "partsCost" = ${input.partsCost},
      "totalCost" = ${totalCost},
      "warrantyClaimId" = ${input.warrantyClaimId},
      "partsUsed" = ${input.partsUsed},
      "notes" = ${input.notes},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteRepair(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Repair"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}
