import { sql } from "@/server/db"

export const PRODUCT_UNITS = [
  "EACH",
  "LB",
  "OZ",
  "GALLON",
  "QUART",
  "LITER",
  "COUNT",
  "PACK",
  "BAG",
  "BOX",
  "CAN",
  "BOTTLE",
  "BUNCH",
  "DOZEN",
] as const

export type ProductUnit = (typeof PRODUCT_UNITS)[number]

export type CategoryRow = {
  id: string
  name: string
}

export type ProductListRow = {
  id: string
  name: string
  brand: string | null
  defaultUnit: ProductUnit
  notes: string | null
  isFavorite: boolean
  categoryId: string | null
  categoryName: string | null
  latestPrice: number | null
}

export type PriceRow = {
  id: string
  storeId: string
  storeName: string
  storeColor: string | null
  price: number
  onSale: boolean
  observedAt: string
  notes: string | null
}

// Latest observation per (product, store) — the price-compare grid cell.
export type LatestPriceRow = {
  productId: string
  storeId: string
  price: number
  onSale: boolean
}

export type ProductInput = {
  name: string
  categoryId: string | null
  brand: string | null
  defaultUnit: ProductUnit
  notes: string | null
}

// ─── Categories ─────────────────────────────────────────

export async function listCategories(
  householdId: string
): Promise<Array<CategoryRow>> {
  return sql<Array<CategoryRow>>`
    SELECT "id", "name"
    FROM "ProductCategory"
    WHERE "householdId" = ${householdId}
    ORDER BY "name" ASC`
}

export async function categoryNameTaken(
  householdId: string,
  name: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "ProductCategory"
    WHERE "householdId" = ${householdId} AND "name" = ${name}
    LIMIT 1`
  return rows.length > 0
}

export async function createCategory(
  householdId: string,
  name: string
): Promise<void> {
  await sql`
    INSERT INTO "ProductCategory" ("householdId", "name")
    VALUES (${householdId}, ${name})`
}

// Ownership re-check for category ids arriving from the client.
export async function categoryBelongsToHousehold(
  householdId: string,
  categoryId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "ProductCategory"
    WHERE "id" = ${categoryId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// ─── Products ───────────────────────────────────────────

export async function listProducts(
  householdId: string
): Promise<Array<ProductListRow>> {
  return sql<Array<ProductListRow>>`
    SELECT p."id", p."name", p."brand", p."defaultUnit", p."notes",
           p."isFavorite", p."categoryId", c."name" AS "categoryName",
           lp."price"::float8 AS "latestPrice"
    FROM "Product" p
    LEFT JOIN "ProductCategory" c ON c."id" = p."categoryId"
    LEFT JOIN LATERAL (
      SELECT sp."price" FROM "StorePrice" sp
      WHERE sp."productId" = p."id"
      ORDER BY sp."observedAt" DESC, sp."createdAt" DESC
      LIMIT 1
    ) lp ON true
    WHERE p."householdId" = ${householdId} AND p."isActive"
    ORDER BY p."name" ASC`
}

export async function getProduct(
  householdId: string,
  id: string
): Promise<ProductListRow | null> {
  const rows = await sql<Array<ProductListRow>>`
    SELECT p."id", p."name", p."brand", p."defaultUnit", p."notes",
           p."isFavorite", p."categoryId", c."name" AS "categoryName",
           NULL::float8 AS "latestPrice"
    FROM "Product" p
    LEFT JOIN "ProductCategory" c ON c."id" = p."categoryId"
    WHERE p."id" = ${id} AND p."householdId" = ${householdId}`
  return rows[0] ?? null
}

// Ownership re-check before mutating child rows (StorePrice, PantryItem)
// referencing a product id from the client (ADR-0005). Returns the default
// unit so pantry adds can fall back to it, like the legacy app did.
export async function getProductBasic(
  householdId: string,
  id: string
): Promise<{ id: string; defaultUnit: ProductUnit } | null> {
  const rows = await sql<Array<{ id: string; defaultUnit: ProductUnit }>>`
    SELECT "id", "defaultUnit" FROM "Product"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

export async function createProduct(
  householdId: string,
  input: ProductInput
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Product"
      ("householdId", "categoryId", "name", "brand", "defaultUnit", "notes")
    VALUES (${householdId}, ${input.categoryId}, ${input.name}, ${input.brand},
            ${input.defaultUnit}::"ProductUnit", ${input.notes})
    RETURNING "id"`
  return rows[0].id
}

export async function updateProduct(
  householdId: string,
  id: string,
  input: ProductInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Product" SET
      "name" = ${input.name},
      "categoryId" = ${input.categoryId},
      "brand" = ${input.brand},
      "defaultUnit" = ${input.defaultUnit}::"ProductUnit",
      "notes" = ${input.notes},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteProduct(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Product"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function toggleProductFavorite(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Product"
    SET "isFavorite" = NOT "isFavorite", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// ─── Prices ─────────────────────────────────────────────

// StorePrice has no householdId — scope through the parent Product.
export async function listPricesForProduct(
  householdId: string,
  productId: string
): Promise<Array<PriceRow>> {
  return sql<Array<PriceRow>>`
    SELECT sp."id", sp."storeId", s."name" AS "storeName",
           s."color" AS "storeColor", sp."price"::float8, sp."onSale",
           sp."observedAt"::text, sp."notes"
    FROM "StorePrice" sp
    JOIN "Product" p ON p."id" = sp."productId"
    JOIN "Store" s ON s."id" = sp."storeId"
    WHERE sp."productId" = ${productId} AND p."householdId" = ${householdId}
    ORDER BY sp."observedAt" DESC, sp."createdAt" DESC`
}

// Caller must have verified product AND store ownership first (scoped joins).
export async function insertPrice(
  productId: string,
  storeId: string,
  price: number,
  observedAt: string | null,
  onSale: boolean,
  notes: string | null
): Promise<void> {
  await sql`
    INSERT INTO "StorePrice"
      ("productId", "storeId", "price", "observedAt", "onSale", "notes")
    VALUES (${productId}, ${storeId}, ${price},
            COALESCE(${observedAt}::date, CURRENT_DATE), ${onSale}, ${notes})`
}

export async function deletePrice(
  householdId: string,
  priceId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "StorePrice" sp
    USING "Product" p
    WHERE sp."id" = ${priceId} AND p."id" = sp."productId"
      AND p."householdId" = ${householdId}
    RETURNING sp."id"`
  return rows.length > 0
}

// Latest price per product per store across the household's active products —
// the legacy price-compare page took the newest observation per cell.
export async function listLatestPrices(
  householdId: string
): Promise<Array<LatestPriceRow>> {
  return sql<Array<LatestPriceRow>>`
    SELECT DISTINCT ON (sp."productId", sp."storeId")
           sp."productId", sp."storeId", sp."price"::float8, sp."onSale"
    FROM "StorePrice" sp
    JOIN "Product" p ON p."id" = sp."productId"
    WHERE p."householdId" = ${householdId} AND p."isActive"
    ORDER BY sp."productId", sp."storeId",
             sp."observedAt" DESC, sp."createdAt" DESC`
}
