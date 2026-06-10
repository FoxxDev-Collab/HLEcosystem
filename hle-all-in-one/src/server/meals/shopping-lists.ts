// Local shopping lists. "ShoppingListItem" has no householdId of its own —
// every item query scopes through its parent "ShoppingList" (invariant 2).
import { sql } from "@/server/db"
import type { ProductUnit } from "./ingredients"

export type ShoppingListStatus = "DRAFT" | "ACTIVE" | "COMPLETED"

export type ShoppingListRow = {
  id: string
  name: string
  status: ShoppingListStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
  itemCount: number
  checkedCount: number
}

export type ShoppingListItemRow = {
  id: string
  listId: string
  productId: string
  productName: string
  categoryName: string | null
  storeId: string | null
  quantity: number
  unit: ProductUnit | null
  notes: string | null
  isChecked: boolean
  sortOrder: number
}

export type ProductOptionRow = {
  id: string
  name: string
}

export type StoreOptionRow = {
  id: string
  name: string
  color: string | null
}

export type LatestStorePriceRow = {
  productId: string
  storeId: string
  storeName: string
  storeColor: string | null
  price: number
}

export async function listShoppingLists(
  householdId: string
): Promise<Array<ShoppingListRow>> {
  return sql<Array<ShoppingListRow>>`
    SELECT l."id", l."name", l."status", l."notes", l."createdAt", l."updatedAt",
           COUNT(i."id")::int AS "itemCount",
           COUNT(i."id") FILTER (WHERE i."isChecked")::int AS "checkedCount"
    FROM "ShoppingList" l
    LEFT JOIN "ShoppingListItem" i ON i."listId" = l."id"
    WHERE l."householdId" = ${householdId}
    GROUP BY l."id"
    ORDER BY l."updatedAt" DESC`
}

// DRAFT/ACTIVE lists — targets for merges and sync commits.
export async function listOpenShoppingLists(
  householdId: string
): Promise<Array<ShoppingListRow>> {
  return sql<Array<ShoppingListRow>>`
    SELECT l."id", l."name", l."status", l."notes", l."createdAt", l."updatedAt",
           COUNT(i."id")::int AS "itemCount",
           COUNT(i."id") FILTER (WHERE i."isChecked")::int AS "checkedCount"
    FROM "ShoppingList" l
    LEFT JOIN "ShoppingListItem" i ON i."listId" = l."id"
    WHERE l."householdId" = ${householdId} AND l."status" IN ('DRAFT', 'ACTIVE')
    GROUP BY l."id"
    ORDER BY l."updatedAt" DESC`
}

export async function getShoppingList(
  householdId: string,
  id: string
): Promise<ShoppingListRow | null> {
  const rows = await sql<Array<ShoppingListRow>>`
    SELECT l."id", l."name", l."status", l."notes", l."createdAt", l."updatedAt",
           COUNT(i."id")::int AS "itemCount",
           COUNT(i."id") FILTER (WHERE i."isChecked")::int AS "checkedCount"
    FROM "ShoppingList" l
    LEFT JOIN "ShoppingListItem" i ON i."listId" = l."id"
    WHERE l."id" = ${id} AND l."householdId" = ${householdId}
    GROUP BY l."id"`
  return rows[0] ?? null
}

export async function listBelongsToHousehold(
  householdId: string,
  listId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "ShoppingList"
    WHERE "id" = ${listId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

export async function listItemsForList(
  householdId: string,
  listId: string
): Promise<Array<ShoppingListItemRow>> {
  return sql<Array<ShoppingListItemRow>>`
    SELECT i."id", i."listId", i."productId", p."name" AS "productName",
           c."name" AS "categoryName", i."storeId", i."quantity"::float8,
           i."unit", i."notes", i."isChecked", i."sortOrder"
    FROM "ShoppingListItem" i
    JOIN "ShoppingList" l ON l."id" = i."listId"
    JOIN "Product" p ON p."id" = i."productId"
    LEFT JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE i."listId" = ${listId} AND l."householdId" = ${householdId}
    ORDER BY i."isChecked" ASC, i."sortOrder" ASC`
}

export async function createShoppingList(
  householdId: string,
  name: string,
  status: ShoppingListStatus,
  notes: string | null
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "ShoppingList" ("householdId", "name", "status", "notes")
    VALUES (${householdId}, ${name}, ${status}::"ShoppingListStatus", ${notes})
    RETURNING "id"`
  return rows[0].id
}

export async function updateListStatus(
  householdId: string,
  id: string,
  status: ShoppingListStatus
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "ShoppingList"
    SET "status" = ${status}::"ShoppingListStatus", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteShoppingList(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ShoppingList"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Copies a list (and its items, unchecked) as "<name> (Copy)" in DRAFT.
export async function duplicateShoppingList(
  householdId: string,
  id: string
): Promise<string | null> {
  const source = await getShoppingList(householdId, id)
  if (!source) return null
  const newId = await createShoppingList(
    householdId,
    `${source.name} (Copy)`,
    "DRAFT",
    null
  )
  await sql`
    INSERT INTO "ShoppingListItem"
      ("listId", "productId", "storeId", "quantity", "unit", "notes",
       "isChecked", "sortOrder")
    SELECT ${newId}, i."productId", i."storeId", i."quantity", i."unit",
           i."notes", false, i."sortOrder"
    FROM "ShoppingListItem" i
    JOIN "ShoppingList" l ON l."id" = i."listId"
    WHERE i."listId" = ${id} AND l."householdId" = ${householdId}`
  return newId
}

// Bump updatedAt after item-level writes (callers have already verified the
// list belongs to the household).
export async function touchShoppingList(listId: string): Promise<void> {
  await sql`
    UPDATE "ShoppingList" SET "updatedAt" = now() WHERE "id" = ${listId}`
}

// ── Items ───────────────────────────────────────────────

export async function addListItem(
  listId: string,
  productId: string,
  quantity: number,
  unit: ProductUnit | null,
  notes: string | null,
  sortOrder = 0
): Promise<void> {
  await sql`
    INSERT INTO "ShoppingListItem"
      ("listId", "productId", "quantity", "unit", "notes", "sortOrder")
    VALUES (${listId}, ${productId}, ${quantity},
            ${unit}::"ProductUnit", ${notes}, ${sortOrder})`
}

export async function findListItemByProduct(
  listId: string,
  productId: string
): Promise<{ id: string; quantity: number; notes: string | null } | null> {
  const rows = await sql<
    Array<{ id: string; quantity: number; notes: string | null }>
  >`
    SELECT "id", "quantity"::float8, "notes" FROM "ShoppingListItem"
    WHERE "listId" = ${listId} AND "productId" = ${productId}
    LIMIT 1`
  return rows[0] ?? null
}

export async function incrementListItem(
  itemId: string,
  addQuantity: number,
  notes: string | null
): Promise<void> {
  await sql`
    UPDATE "ShoppingListItem"
    SET "quantity" = "quantity" + ${addQuantity},
        "notes" = COALESCE(${notes}, "notes")
    WHERE "id" = ${itemId}`
}

export async function toggleListItem(
  householdId: string,
  itemId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "ShoppingListItem" i
    SET "isChecked" = NOT i."isChecked"
    FROM "ShoppingList" l
    WHERE i."id" = ${itemId} AND l."id" = i."listId"
      AND l."householdId" = ${householdId}
    RETURNING i."id"`
  return rows.length > 0
}

export async function removeListItem(
  householdId: string,
  itemId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ShoppingListItem" i
    USING "ShoppingList" l
    WHERE i."id" = ${itemId} AND l."id" = i."listId"
      AND l."householdId" = ${householdId}
    RETURNING i."id"`
  return rows.length > 0
}

export async function productBelongsToHousehold(
  householdId: string,
  productId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Product"
    WHERE "id" = ${productId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// ── Pickers ─────────────────────────────────────────────

export async function listActiveProducts(
  householdId: string
): Promise<Array<ProductOptionRow>> {
  return sql<Array<ProductOptionRow>>`
    SELECT "id", "name" FROM "Product"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "name" ASC`
}

export async function listActiveStores(
  householdId: string
): Promise<Array<StoreOptionRow>> {
  return sql<Array<StoreOptionRow>>`
    SELECT "id", "name", "color" FROM "Store"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "name" ASC`
}

// ── Prices + pantry (shopping strategy) ─────────────────

// Latest observed price per (product, store) for every product on the list.
export async function latestPricesForList(
  householdId: string,
  listId: string
): Promise<Array<LatestStorePriceRow>> {
  return sql<Array<LatestStorePriceRow>>`
    SELECT DISTINCT ON (sp."productId", sp."storeId")
           sp."productId", sp."storeId", s."name" AS "storeName",
           s."color" AS "storeColor", sp."price"::float8
    FROM "StorePrice" sp
    JOIN "Product" p ON p."id" = sp."productId"
      AND p."householdId" = ${householdId}
    JOIN "Store" s ON s."id" = sp."storeId"
    JOIN "ShoppingListItem" i ON i."productId" = sp."productId"
    JOIN "ShoppingList" l ON l."id" = i."listId"
    WHERE l."id" = ${listId} AND l."householdId" = ${householdId}
    ORDER BY sp."productId", sp."storeId", sp."observedAt" DESC,
             sp."createdAt" DESC`
}

// Cheapest current store per product, derived from the latest prices.
export function buildBestPriceMap(latest: Array<LatestStorePriceRow>): Map<
  string,
  {
    price: number
    storeId: string
    storeName: string
    storeColor: string | null
  }
> {
  const best = new Map<
    string,
    {
      price: number
      storeId: string
      storeName: string
      storeColor: string | null
    }
  >()
  for (const row of latest) {
    const current = best.get(row.productId)
    if (!current || row.price < current.price) {
      best.set(row.productId, {
        price: row.price,
        storeId: row.storeId,
        storeName: row.storeName,
        storeColor: row.storeColor,
      })
    }
  }
  return best
}

// productId → on-hand quantity for the whole household.
export async function pantryQuantities(
  householdId: string
): Promise<Map<string, number>> {
  const rows = await sql<Array<{ productId: string; quantity: number }>>`
    SELECT "productId", "quantity"::float8 FROM "PantryItem"
    WHERE "householdId" = ${householdId}`
  return new Map(rows.map((r) => [r.productId, r.quantity]))
}

export type PantryItemWithProductRow = {
  productId: string
  productName: string
  quantity: number
  unit: ProductUnit | null
}

export async function listPantryItemsWithProduct(
  householdId: string,
  onlyInStock = false
): Promise<Array<PantryItemWithProductRow>> {
  if (onlyInStock) {
    return sql<Array<PantryItemWithProductRow>>`
      SELECT pi."productId", p."name" AS "productName",
             pi."quantity"::float8, pi."unit"
      FROM "PantryItem" pi
      JOIN "Product" p ON p."id" = pi."productId"
      WHERE pi."householdId" = ${householdId} AND pi."quantity" > 0
      ORDER BY p."name" ASC`
  }
  return sql<Array<PantryItemWithProductRow>>`
    SELECT pi."productId", p."name" AS "productName",
           pi."quantity"::float8, pi."unit"
    FROM "PantryItem" pi
    JOIN "Product" p ON p."id" = pi."productId"
    WHERE pi."householdId" = ${householdId}
    ORDER BY p."name" ASC`
}

// "Stock pantry from checked items": every checked list item tops up (or
// creates) the pantry row for its product (legacy stockFromListAction).
export async function stockPantryFromCheckedItems(
  householdId: string,
  listId: string
): Promise<number> {
  const items = await sql<
    Array<{
      productId: string
      quantity: number
      unit: ProductUnit | null
      defaultUnit: ProductUnit
    }>
  >`
    SELECT i."productId", i."quantity"::float8, i."unit",
           p."defaultUnit"
    FROM "ShoppingListItem" i
    JOIN "ShoppingList" l ON l."id" = i."listId"
    JOIN "Product" p ON p."id" = i."productId"
    WHERE i."listId" = ${listId} AND l."householdId" = ${householdId}
      AND i."isChecked"`

  for (const item of items) {
    await sql`
      INSERT INTO "PantryItem" ("householdId", "productId", "quantity", "unit")
      VALUES (${householdId}, ${item.productId}, ${item.quantity},
              ${item.unit ?? item.defaultUnit}::"ProductUnit")
      ON CONFLICT ("productId") DO UPDATE
      SET "quantity" = "PantryItem"."quantity" + ${item.quantity},
          "updatedAt" = now()
      WHERE "PantryItem"."householdId" = ${householdId}`
  }
  return items.length
}

// Latest price per product across all stores (recipe cost estimates).
export async function latestPricePerProduct(
  householdId: string
): Promise<Map<string, number>> {
  const rows = await sql<Array<{ productId: string; price: number }>>`
    SELECT DISTINCT ON (sp."productId") sp."productId", sp."price"::float8
    FROM "StorePrice" sp
    JOIN "Product" p ON p."id" = sp."productId"
    WHERE p."householdId" = ${householdId}
    ORDER BY sp."productId", sp."observedAt" DESC, sp."createdAt" DESC`
  return new Map(rows.map((r) => [r.productId, r.price]))
}
