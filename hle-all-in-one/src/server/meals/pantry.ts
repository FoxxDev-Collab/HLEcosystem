import { sql } from "@/server/db"
import type { ProductUnit } from "./products"

export type PantryFilter =
  | "all"
  | "in-stock"
  | "low-stock"
  | "out-of-stock"
  | "expiring"

export type PantrySort = "name" | "quantity" | "expiration"
export type PantrySortDir = "asc" | "desc"

export type PantryItemRow = {
  id: string
  productId: string
  quantity: number
  unit: ProductUnit | null
  minQuantity: number | null
  expiresAt: string | null
  productName: string
  productBrand: string | null
  defaultUnit: ProductUnit
  categoryName: string | null
}

export type PantryStats = {
  total: number
  inStock: number
  lowStock: number
  outOfStock: number
  expiring: number
}

export type AvailableProductRow = {
  id: string
  name: string
  brand: string | null
  defaultUnit: ProductUnit
}

export type ActiveListRow = {
  id: string
  name: string
  checkedCount: number
}

export type PantryQueryOpts = {
  q: string | null
  filter: PantryFilter
  sort: PantrySort
  dir: PantrySortDir
  limit: number
  offset: number
}

// One query, plain WHERE clauses. The legacy app filtered low-stock/in-stock
// post-query because Prisma can't compare quantity <= minQuantity; raw SQL
// can, so every filter tab (and the search) runs in the database.
export async function listPantryItems(
  householdId: string,
  opts: PantryQueryOpts
): Promise<Array<PantryItemRow>> {
  const like = opts.q ? `%${opts.q}%` : null
  const sortKey = `${opts.sort}:${opts.dir}`
  return sql<Array<PantryItemRow>>`
    SELECT pi."id", pi."productId", pi."quantity"::float8, pi."unit",
           pi."minQuantity"::float8, pi."expiresAt"::text,
           p."name" AS "productName", p."brand" AS "productBrand",
           p."defaultUnit", c."name" AS "categoryName"
    FROM "PantryItem" pi
    JOIN "Product" p ON p."id" = pi."productId"
    LEFT JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE pi."householdId" = ${householdId}
      AND (${like}::text IS NULL
           OR p."name" ILIKE ${like}
           OR p."brand" ILIKE ${like}
           OR c."name" ILIKE ${like})
      AND (${opts.filter} = 'all'
           OR (${opts.filter} = 'out-of-stock' AND pi."quantity" <= 0)
           OR (${opts.filter} = 'expiring'
               AND pi."expiresAt" IS NOT NULL
               AND pi."expiresAt" <= CURRENT_DATE + 7)
           OR (${opts.filter} = 'low-stock'
               AND pi."quantity" > 0
               AND pi."minQuantity" IS NOT NULL
               AND pi."quantity" <= pi."minQuantity")
           OR (${opts.filter} = 'in-stock'
               AND pi."quantity" > 0
               AND (pi."minQuantity" IS NULL
                    OR pi."quantity" > pi."minQuantity")))
    ORDER BY
      CASE WHEN ${sortKey} = 'name:asc' THEN p."name" END ASC,
      CASE WHEN ${sortKey} = 'name:desc' THEN p."name" END DESC,
      CASE WHEN ${sortKey} = 'quantity:asc' THEN pi."quantity" END ASC,
      CASE WHEN ${sortKey} = 'quantity:desc' THEN pi."quantity" END DESC,
      CASE WHEN ${sortKey} = 'expiration:asc' THEN pi."expiresAt" END ASC NULLS LAST,
      CASE WHEN ${sortKey} = 'expiration:desc' THEN pi."expiresAt" END DESC NULLS LAST,
      p."name" ASC
    LIMIT ${opts.limit} OFFSET ${opts.offset}`
}

export async function countPantryItems(
  householdId: string,
  opts: Pick<PantryQueryOpts, "q" | "filter">
): Promise<number> {
  const like = opts.q ? `%${opts.q}%` : null
  const rows = await sql<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM "PantryItem" pi
    JOIN "Product" p ON p."id" = pi."productId"
    LEFT JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE pi."householdId" = ${householdId}
      AND (${like}::text IS NULL
           OR p."name" ILIKE ${like}
           OR p."brand" ILIKE ${like}
           OR c."name" ILIKE ${like})
      AND (${opts.filter} = 'all'
           OR (${opts.filter} = 'out-of-stock' AND pi."quantity" <= 0)
           OR (${opts.filter} = 'expiring'
               AND pi."expiresAt" IS NOT NULL
               AND pi."expiresAt" <= CURRENT_DATE + 7)
           OR (${opts.filter} = 'low-stock'
               AND pi."quantity" > 0
               AND pi."minQuantity" IS NOT NULL
               AND pi."quantity" <= pi."minQuantity")
           OR (${opts.filter} = 'in-stock'
               AND pi."quantity" > 0
               AND (pi."minQuantity" IS NULL
                    OR pi."quantity" > pi."minQuantity")))`
  return rows[0].count
}

// Counts over the FULL pantry (never narrowed by search/filter), matching the
// legacy stats block. inStock = total - lowStock - outOfStock (legacy rule).
export async function getPantryStats(
  householdId: string
): Promise<PantryStats> {
  const rows = await sql<
    Array<{
      total: number
      lowStock: number
      outOfStock: number
      expiring: number
    }>
  >`
    SELECT COUNT(*)::int AS "total",
           COUNT(*) FILTER (WHERE "quantity" > 0
                              AND "minQuantity" IS NOT NULL
                              AND "quantity" <= "minQuantity")::int AS "lowStock",
           COUNT(*) FILTER (WHERE "quantity" <= 0)::int AS "outOfStock",
           COUNT(*) FILTER (WHERE "expiresAt" IS NOT NULL
                              AND "expiresAt" <= CURRENT_DATE + 7)::int AS "expiring"
    FROM "PantryItem"
    WHERE "householdId" = ${householdId}`
  const { total, lowStock, outOfStock, expiring } = rows[0]
  return {
    total,
    inStock: total - lowStock - outOfStock,
    lowStock,
    outOfStock,
    expiring,
  }
}

// Active products not yet in the pantry — feeds the "add to pantry" picker.
export async function listAvailableProducts(
  householdId: string
): Promise<Array<AvailableProductRow>> {
  return sql<Array<AvailableProductRow>>`
    SELECT p."id", p."name", p."brand", p."defaultUnit"
    FROM "Product" p
    LEFT JOIN "PantryItem" pi ON pi."productId" = p."id"
    WHERE p."householdId" = ${householdId} AND p."isActive"
      AND pi."id" IS NULL
    ORDER BY p."name" ASC`
}

// ACTIVE shopping lists that have at least one checked item — candidates for
// "stock from list". The ShoppingList tables are read-only from this module.
export async function listActiveListsWithChecked(
  householdId: string
): Promise<Array<ActiveListRow>> {
  return sql<Array<ActiveListRow>>`
    SELECT l."id", l."name", COUNT(i."id")::int AS "checkedCount"
    FROM "ShoppingList" l
    JOIN "ShoppingListItem" i ON i."listId" = l."id" AND i."isChecked"
    WHERE l."householdId" = ${householdId} AND l."status" = 'ACTIVE'
    GROUP BY l."id", l."name", l."updatedAt"
    ORDER BY l."updatedAt" DESC`
}

export async function getPantryItemForProduct(
  householdId: string,
  productId: string
): Promise<{ quantity: number; unit: ProductUnit | null } | null> {
  const rows = await sql<Array<{ quantity: number; unit: ProductUnit | null }>>`
    SELECT "quantity"::float8, "unit"
    FROM "PantryItem"
    WHERE "productId" = ${productId} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

// Caller must verify product ownership first. Returns false when the product
// is already in the pantry (UNIQUE "productId") so the fn can return { error }.
export async function addPantryItem(
  householdId: string,
  productId: string,
  quantity: number,
  unit: ProductUnit,
  minQuantity: number | null,
  expiresAt: string | null
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "PantryItem"
      ("householdId", "productId", "quantity", "unit", "minQuantity",
       "expiresAt")
    VALUES (${householdId}, ${productId}, ${quantity},
            ${unit}::"ProductUnit", ${minQuantity}, ${expiresAt})
    ON CONFLICT ("productId") DO NOTHING
    RETURNING "id"`
  return rows.length > 0
}

export async function setPantryQuantity(
  householdId: string,
  id: string,
  quantity: number
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "PantryItem"
    SET "quantity" = ${quantity}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// Quick +1/-1 adjust, clamped at zero (legacy rule).
export async function adjustPantryQuantity(
  householdId: string,
  id: string,
  amount: number
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "PantryItem"
    SET "quantity" = GREATEST(0, "quantity" + ${amount}), "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function setPantryMin(
  householdId: string,
  id: string,
  minQuantity: number | null
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "PantryItem"
    SET "minQuantity" = ${minQuantity}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function setPantryExpiration(
  householdId: string,
  id: string,
  expiresAt: string | null
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "PantryItem"
    SET "expiresAt" = ${expiresAt}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function removePantryItem(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "PantryItem"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// "Stock from list": add every checked item of an owned ACTIVE list to the
// pantry — incrementing quantity when the product is already stocked,
// otherwise creating the row with the item's unit (falling back to the
// product default), exactly like the legacy action. Returns false when the
// list doesn't belong to the household.
export async function stockFromList(
  householdId: string,
  listId: string
): Promise<boolean> {
  const lists = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "ShoppingList"
    WHERE "id" = ${listId} AND "householdId" = ${householdId}`
  if (lists.length === 0) return false

  const items = await sql<
    Array<{
      productId: string
      quantity: number
      unit: ProductUnit | null
      defaultUnit: ProductUnit
    }>
  >`
    SELECT i."productId", i."quantity"::float8, i."unit", p."defaultUnit"
    FROM "ShoppingListItem" i
    JOIN "Product" p ON p."id" = i."productId"
    WHERE i."listId" = ${listId} AND i."isChecked"`

  for (const item of items) {
    const unit = item.unit ?? item.defaultUnit
    // The DO UPDATE re-checks householdId: a PantryItem row for this product
    // can only ever belong to the product's household, but verify anyway.
    await sql`
      INSERT INTO "PantryItem" ("householdId", "productId", "quantity", "unit")
      VALUES (${householdId}, ${item.productId}, ${item.quantity},
              ${unit}::"ProductUnit")
      ON CONFLICT ("productId") DO UPDATE
      SET "quantity" = "PantryItem"."quantity" + EXCLUDED."quantity",
          "updatedAt" = now()
      WHERE "PantryItem"."householdId" = ${householdId}`
  }
  return true
}
