// Finance assets & net worth (legacy assets/actions.ts + assets pages).
//
// SECURITY (ADR-0005): AssetValueHistory has no householdId — it scopes
// through its parent Asset. Client-supplied linkedDebtId is re-verified
// against the household. The legacy updateAssetValueAction and
// archiveAssetAction mutated by bare id; those gaps are closed here.
import { sql } from "@/server/db"

import type { AssetType } from "@/lib/finance-constants"

export { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/finance-constants"
export type { AssetType }

export type AssetRow = {
  id: string
  type: AssetType
  name: string
  purchasePrice: number | null
  purchaseDate: string | null
  currentValue: number
  valueAsOfDate: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  squareFootage: number | null
  yearBuilt: number | null
  propertyTaxAnnual: number | null
  make: string | null
  model: string | null
  vehicleYear: number | null
  vin: string | null
  mileage: number | null
  isSold: boolean
  soldPrice: number | null
  soldDate: string | null
  linkedDebtId: string | null
  linkedDebtName: string | null
  linkedDebtBalance: number | null
  includeInNetWorth: boolean
  notes: string | null
  isArchived: boolean
}

export type AssetValueHistoryRow = {
  id: string
  date: string
  value: number
  source: string | null
  notes: string | null
}

export async function listAssets(
  householdId: string
): Promise<Array<AssetRow>> {
  return sql<Array<AssetRow>>`
    SELECT a."id", a."type", a."name", a."purchasePrice"::float8,
           a."purchaseDate"::text, a."currentValue"::float8,
           a."valueAsOfDate"::text, a."address", a."city", a."state",
           a."zipCode", a."squareFootage", a."yearBuilt",
           a."propertyTaxAnnual"::float8, a."make", a."model",
           a."vehicleYear", a."vin", a."mileage", a."isSold",
           a."soldPrice"::float8, a."soldDate"::text, a."linkedDebtId",
           d."name" AS "linkedDebtName",
           d."currentBalance"::float8 AS "linkedDebtBalance",
           a."includeInNetWorth", a."notes", a."isArchived"
    FROM "Asset" a
    LEFT JOIN "Debt" d ON d."id" = a."linkedDebtId"
    WHERE a."householdId" = ${householdId}
    ORDER BY a."isArchived" ASC, a."type" ASC, a."currentValue" DESC`
}

export async function getAsset(
  householdId: string,
  id: string
): Promise<AssetRow | null> {
  const [row] = await sql<Array<AssetRow>>`
    SELECT a."id", a."type", a."name", a."purchasePrice"::float8,
           a."purchaseDate"::text, a."currentValue"::float8,
           a."valueAsOfDate"::text, a."address", a."city", a."state",
           a."zipCode", a."squareFootage", a."yearBuilt",
           a."propertyTaxAnnual"::float8, a."make", a."model",
           a."vehicleYear", a."vin", a."mileage", a."isSold",
           a."soldPrice"::float8, a."soldDate"::text, a."linkedDebtId",
           d."name" AS "linkedDebtName",
           d."currentBalance"::float8 AS "linkedDebtBalance",
           a."includeInNetWorth", a."notes", a."isArchived"
    FROM "Asset" a
    LEFT JOIN "Debt" d ON d."id" = a."linkedDebtId"
    WHERE a."id" = ${id} AND a."householdId" = ${householdId}`
  return row ?? null
}

// History scopes through the parent Asset (child table, no householdId).
export async function listAssetValueHistory(
  householdId: string,
  assetId: string
): Promise<Array<AssetValueHistoryRow>> {
  return sql<Array<AssetValueHistoryRow>>`
    SELECT h."id", h."date"::text, h."value"::float8, h."source", h."notes"
    FROM "AssetValueHistory" h
    JOIN "Asset" a ON a."id" = h."assetId"
    WHERE h."assetId" = ${assetId} AND a."householdId" = ${householdId}
    ORDER BY h."date" DESC, h."createdAt" DESC
    LIMIT 20`
}

export type AssetInput = {
  name: string
  type: AssetType
  currentValue: number
  purchasePrice: number | null
  purchaseDate: string | null
  linkedDebtId: string | null
  notes: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  squareFootage: number | null
  yearBuilt: number | null
  propertyTaxAnnual: number | null
  make: string | null
  model: string | null
  vehicleYear: number | null
  vin: string | null
  mileage: number | null
}

// Re-verify a client-supplied linkedDebtId against the household (ADR-0005).
async function verifyLinkedDebt(
  householdId: string,
  linkedDebtId: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!linkedDebtId) return { ok: true }
  const [debt] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Debt"
    WHERE "id" = ${linkedDebtId} AND "householdId" = ${householdId}`
  if (!debt) return { error: "Linked debt not found" }
  return { ok: true }
}

export async function createAsset(
  householdId: string,
  input: AssetInput
): Promise<{ id: string } | { error: string }> {
  const refs = await verifyLinkedDebt(householdId, input.linkedDebtId)
  if ("error" in refs) return refs

  return sql.begin(async (tx) => {
    const [asset] = await tx<Array<{ id: string }>>`
      INSERT INTO "Asset" (
        "householdId", "name", "type", "currentValue", "purchasePrice",
        "purchaseDate", "valueAsOfDate", "notes", "linkedDebtId",
        "address", "city", "state", "zipCode", "squareFootage", "yearBuilt",
        "propertyTaxAnnual", "make", "model", "vehicleYear", "vin", "mileage"
      ) VALUES (
        ${householdId}, ${input.name}, ${input.type}, ${input.currentValue},
        ${input.purchasePrice}, ${input.purchaseDate}, CURRENT_DATE,
        ${input.notes}, ${input.linkedDebtId}, ${input.address},
        ${input.city}, ${input.state}, ${input.zipCode},
        ${input.squareFootage}, ${input.yearBuilt},
        ${input.propertyTaxAnnual}, ${input.make}, ${input.model},
        ${input.vehicleYear}, ${input.vin}, ${input.mileage}
      ) RETURNING "id"`
    // Record initial value history (legacy behavior).
    await tx`
      INSERT INTO "AssetValueHistory" ("assetId", "date", "value", "source")
      VALUES (${asset.id}, CURRENT_DATE, ${input.currentValue}, 'manual')`
    return asset
  })
}

export async function updateAsset(
  householdId: string,
  id: string,
  input: AssetInput
): Promise<{ ok: true } | { error: string }> {
  const refs = await verifyLinkedDebt(householdId, input.linkedDebtId)
  if ("error" in refs) return refs

  const [row] = await sql<Array<{ id: string }>>`
    UPDATE "Asset"
    SET "name" = ${input.name}, "type" = ${input.type},
        "currentValue" = ${input.currentValue},
        "purchasePrice" = ${input.purchasePrice},
        "purchaseDate" = ${input.purchaseDate},
        "valueAsOfDate" = CURRENT_DATE,
        "notes" = ${input.notes}, "linkedDebtId" = ${input.linkedDebtId},
        "address" = ${input.address}, "city" = ${input.city},
        "state" = ${input.state}, "zipCode" = ${input.zipCode},
        "squareFootage" = ${input.squareFootage},
        "yearBuilt" = ${input.yearBuilt},
        "propertyTaxAnnual" = ${input.propertyTaxAnnual},
        "make" = ${input.make}, "model" = ${input.model},
        "vehicleYear" = ${input.vehicleYear}, "vin" = ${input.vin},
        "mileage" = ${input.mileage},
        "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (!row) return { error: "Asset not found" }
  return { ok: true }
}

// Append a value-history entry and roll the asset's currentValue forward.
export async function updateAssetValue(
  householdId: string,
  id: string,
  currentValue: number
): Promise<{ ok: true } | { error: string }> {
  const [asset] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Asset"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!asset) return { error: "Asset not found" }

  await sql.begin(async (tx) => {
    await tx`
      UPDATE "Asset"
      SET "currentValue" = ${currentValue}, "valueAsOfDate" = CURRENT_DATE,
          "updatedAt" = now()
      WHERE "id" = ${asset.id}`
    await tx`
      INSERT INTO "AssetValueHistory" ("assetId", "date", "value", "source")
      VALUES (${asset.id}, CURRENT_DATE, ${currentValue}, 'manual')`
  })
  return { ok: true }
}

export type MarkAssetSoldInput = {
  id: string
  soldPrice: number
  soldDate: string
  archiveDebt: boolean
}

// Mark sold: record sale price/date, archive the asset, append a final
// history entry, optionally archive the linked debt (legacy semantics).
export async function markAssetSold(
  householdId: string,
  input: MarkAssetSoldInput
): Promise<{ ok: true } | { error: string }> {
  const [asset] = await sql<Array<{ id: string; linkedDebtId: string | null }>>`
    SELECT "id", "linkedDebtId" FROM "Asset"
    WHERE "id" = ${input.id} AND "householdId" = ${householdId}`
  if (!asset) return { error: "Asset not found" }

  await sql.begin(async (tx) => {
    await tx`
      UPDATE "Asset"
      SET "isSold" = true, "soldPrice" = ${input.soldPrice},
          "soldDate" = ${input.soldDate}, "isArchived" = true,
          "updatedAt" = now()
      WHERE "id" = ${asset.id}`
    await tx`
      INSERT INTO "AssetValueHistory" (
        "assetId", "date", "value", "source", "notes"
      ) VALUES (
        ${asset.id}, ${input.soldDate}, ${input.soldPrice}, 'sold',
        'Asset sold'
      )`
    if (input.archiveDebt && asset.linkedDebtId) {
      // The debt id comes from the asset row itself (already scoped), but
      // keep the household guard on the UPDATE anyway.
      await tx`
        UPDATE "Debt"
        SET "isArchived" = true, "updatedAt" = now()
        WHERE "id" = ${asset.linkedDebtId}
          AND "householdId" = ${householdId}`
    }
  })
  return { ok: true }
}

export async function setAssetArchived(
  householdId: string,
  id: string,
  isArchived: boolean
): Promise<{ ok: true } | { error: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    UPDATE "Asset"
    SET "isArchived" = ${isArchived}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (!row) return { error: "Asset not found" }
  return { ok: true }
}

export async function deleteAsset(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  // Scoped lookup first (ADR-0005). Value history cascades via FK.
  const [asset] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Asset"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  if (!asset) return { error: "Asset not found" }

  await sql`DELETE FROM "Asset" WHERE "id" = ${asset.id}`
  return { ok: true }
}
