import { sql } from "@/server/db"

export type StoreRow = {
  id: string
  name: string
  location: string | null
  notes: string | null
  color: string | null
  sortOrder: number
  isActive: boolean
  priceCount: number
}

export type ActiveStoreRow = {
  id: string
  name: string
  color: string | null
}

export type StoreInput = {
  name: string
  location: string | null
  notes: string | null
  color: string | null
}

export async function listStores(
  householdId: string
): Promise<Array<StoreRow>> {
  return sql<Array<StoreRow>>`
    SELECT s."id", s."name", s."location", s."notes", s."color", s."sortOrder",
           s."isActive",
           (SELECT COUNT(*)::int FROM "StorePrice" sp
            WHERE sp."storeId" = s."id") AS "priceCount"
    FROM "Store" s
    WHERE s."householdId" = ${householdId}
    ORDER BY s."sortOrder" ASC, s."name" ASC`
}

export async function listActiveStores(
  householdId: string
): Promise<Array<ActiveStoreRow>> {
  return sql<Array<ActiveStoreRow>>`
    SELECT "id", "name", "color"
    FROM "Store"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "name" ASC`
}

// UNIQUE ("householdId", "name") pre-check so duplicates surface as { error }
// instead of a thrown constraint violation.
export async function storeNameTaken(
  householdId: string,
  name: string,
  excludeId: string | null = null
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Store"
    WHERE "householdId" = ${householdId} AND "name" = ${name}
      AND (${excludeId}::uuid IS NULL OR "id" <> ${excludeId}::uuid)
    LIMIT 1`
  return rows.length > 0
}

export async function createStore(
  householdId: string,
  input: StoreInput
): Promise<void> {
  await sql`
    INSERT INTO "Store" ("householdId", "name", "location", "notes", "color")
    VALUES (${householdId}, ${input.name}, ${input.location}, ${input.notes},
            ${input.color})`
}

export async function updateStore(
  householdId: string,
  id: string,
  input: StoreInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Store" SET
      "name" = ${input.name},
      "location" = ${input.location},
      "notes" = ${input.notes},
      "color" = ${input.color},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteStore(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Store"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Ownership re-check before inserting StorePrice rows that reference a store
// id from the client (StorePrice has no householdId of its own — ADR-0005).
export async function storeBelongsToHousehold(
  householdId: string,
  storeId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Store"
    WHERE "id" = ${storeId} AND "householdId" = ${householdId}`
  return rows.length > 0
}
