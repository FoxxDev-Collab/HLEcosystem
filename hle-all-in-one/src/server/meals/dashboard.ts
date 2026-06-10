// Meals dashboard stats (ported from hle-meal_prep dashboard page queries).
import { sql } from "@/server/db"
import type { ProductUnit } from "./ingredients"

export type MealsDashboardCounts = {
  productCount: number
  storeCount: number
  activeListCount: number
  priceCount: number
}

export type RecentPriceRow = {
  id: string
  productId: string
  productName: string
  storeName: string
  storeColor: string | null
  price: number
  observedAt: string
  onSale: boolean
}

export type ActiveListRow = {
  id: string
  name: string
  itemCount: number
  checkedCount: number
}

export type PantryAlertRow = {
  id: string
  productName: string
  quantity: number
  minQuantity: number | null
  unit: ProductUnit | null
  expiresAt: string | null
}

export async function getDashboardCounts(
  householdId: string
): Promise<MealsDashboardCounts> {
  const rows = await sql<Array<MealsDashboardCounts>>`
    SELECT
      (SELECT COUNT(*)::int FROM "Product"
       WHERE "householdId" = ${householdId} AND "isActive") AS "productCount",
      (SELECT COUNT(*)::int FROM "Store"
       WHERE "householdId" = ${householdId} AND "isActive") AS "storeCount",
      (SELECT COUNT(*)::int FROM "ShoppingList"
       WHERE "householdId" = ${householdId}
         AND "status" = 'ACTIVE') AS "activeListCount",
      (SELECT COUNT(*)::int FROM "StorePrice" sp
       JOIN "Product" p ON p."id" = sp."productId"
       WHERE p."householdId" = ${householdId}) AS "priceCount"`
  return rows[0]
}

export async function listRecentPrices(
  householdId: string,
  limit = 8
): Promise<Array<RecentPriceRow>> {
  return sql<Array<RecentPriceRow>>`
    SELECT sp."id", sp."productId", p."name" AS "productName",
           s."name" AS "storeName", s."color" AS "storeColor",
           sp."price"::float8, sp."observedAt"::text, sp."onSale"
    FROM "StorePrice" sp
    JOIN "Product" p ON p."id" = sp."productId"
    JOIN "Store" s ON s."id" = sp."storeId"
    WHERE p."householdId" = ${householdId}
    ORDER BY sp."createdAt" DESC
    LIMIT ${limit}`
}

export async function listActiveListsWithProgress(
  householdId: string
): Promise<Array<ActiveListRow>> {
  return sql<Array<ActiveListRow>>`
    SELECT l."id", l."name",
           COUNT(i."id")::int AS "itemCount",
           COUNT(i."id") FILTER (WHERE i."isChecked")::int AS "checkedCount"
    FROM "ShoppingList" l
    LEFT JOIN "ShoppingListItem" i ON i."listId" = l."id"
    WHERE l."householdId" = ${householdId} AND l."status" = 'ACTIVE'
    GROUP BY l."id"
    ORDER BY l."updatedAt" DESC`
}

// In stock but at/below the configured minimum.
export async function listLowStockItems(
  householdId: string
): Promise<Array<PantryAlertRow>> {
  return sql<Array<PantryAlertRow>>`
    SELECT pi."id", p."name" AS "productName", pi."quantity"::float8,
           pi."minQuantity"::float8, pi."unit", pi."expiresAt"::text
    FROM "PantryItem" pi
    JOIN "Product" p ON p."id" = pi."productId"
    WHERE pi."householdId" = ${householdId}
      AND pi."minQuantity" IS NOT NULL
      AND pi."quantity" > 0
      AND pi."quantity" <= pi."minQuantity"
    ORDER BY p."name" ASC`
}

export async function countOutOfStockItems(
  householdId: string
): Promise<number> {
  const rows = await sql<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count" FROM "PantryItem"
    WHERE "householdId" = ${householdId} AND "quantity" <= 0`
  return rows[0]?.count ?? 0
}

// In stock and expiring within the next 7 days (or already expired).
export async function listExpiringItems(
  householdId: string,
  limit = 5
): Promise<Array<PantryAlertRow>> {
  return sql<Array<PantryAlertRow>>`
    SELECT pi."id", p."name" AS "productName", pi."quantity"::float8,
           pi."minQuantity"::float8, pi."unit", pi."expiresAt"::text
    FROM "PantryItem" pi
    JOIN "Product" p ON p."id" = pi."productId"
    WHERE pi."householdId" = ${householdId}
      AND pi."expiresAt" IS NOT NULL
      AND pi."expiresAt" <= CURRENT_DATE + 7
      AND pi."quantity" > 0
    ORDER BY pi."expiresAt" ASC
    LIMIT ${limit}`
}
