// Finance wishlists (legacy wishlist/actions.ts + wishlist pages).
// WishlistItem has no householdId — every item query scopes through its
// parent Wishlist (ADR-0005).
import { sql } from "@/server/db"

export type WishlistRow = {
  id: string
  name: string
  description: string | null
  createdAt: Date
  itemCount: number
  purchasedCount: number
  // Sum over unpurchased items: (low+high)/2 when both set, else whichever
  // price exists (legacy estimate logic).
  estimatedTotal: number
}

export type WishlistItemRow = {
  id: string
  name: string
  lowPrice: number | null
  highPrice: number | null
  url: string | null
  sortOrder: number
  isPurchased: boolean
}

export async function listWishlists(
  householdId: string
): Promise<Array<WishlistRow>> {
  return sql<Array<WishlistRow>>`
    SELECT w."id", w."name", w."description", w."createdAt",
           count(i."id")::int AS "itemCount",
           (count(i."id") FILTER (WHERE i."isPurchased"))::int AS "purchasedCount",
           COALESCE(sum(
             CASE
               WHEN COALESCE(i."lowPrice", 0) > 0 AND COALESCE(i."highPrice", 0) > 0
                 THEN (i."lowPrice" + i."highPrice") / 2
               ELSE GREATEST(COALESCE(i."lowPrice", 0), COALESCE(i."highPrice", 0))
             END
           ) FILTER (WHERE NOT i."isPurchased"), 0)::float8 AS "estimatedTotal"
    FROM "Wishlist" w
    LEFT JOIN "WishlistItem" i ON i."wishlistId" = w."id"
    WHERE w."householdId" = ${householdId}
    GROUP BY w."id"
    ORDER BY w."createdAt" DESC`
}

export async function getWishlist(
  householdId: string,
  id: string
): Promise<{ id: string; name: string; description: string | null } | null> {
  const [row] = await sql<
    Array<{ id: string; name: string; description: string | null }>
  >`
    SELECT "id", "name", "description"
    FROM "Wishlist"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return row ?? null
}

export async function listWishlistItems(
  householdId: string,
  wishlistId: string
): Promise<Array<WishlistItemRow>> {
  return sql<Array<WishlistItemRow>>`
    SELECT i."id", i."name", i."lowPrice"::float8, i."highPrice"::float8,
           i."url", i."sortOrder", i."isPurchased"
    FROM "WishlistItem" i
    JOIN "Wishlist" w ON w."id" = i."wishlistId"
    WHERE i."wishlistId" = ${wishlistId} AND w."householdId" = ${householdId}
    ORDER BY i."isPurchased" ASC, i."sortOrder" ASC, i."createdAt" ASC`
}

export async function createWishlist(
  householdId: string,
  name: string,
  description: string | null
): Promise<{ id: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    INSERT INTO "Wishlist" ("householdId", "name", "description")
    VALUES (${householdId}, ${name}, ${description})
    RETURNING "id"`
  return row
}

export async function updateWishlist(
  householdId: string,
  id: string,
  name: string,
  description: string | null
): Promise<void> {
  await sql`
    UPDATE "Wishlist"
    SET "name" = ${name}, "description" = ${description}, "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
}

export async function deleteWishlist(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const deleted = await sql<Array<{ id: string }>>`
    DELETE FROM "Wishlist"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  if (deleted.length === 0) return { error: "Wishlist not found" }
  return { ok: true }
}

export type WishlistItemInput = {
  name: string
  lowPrice: number | null
  highPrice: number | null
  url: string | null
}

export async function addWishlistItem(
  householdId: string,
  wishlistId: string,
  input: WishlistItemInput
): Promise<{ ok: true } | { error: string }> {
  const [list] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Wishlist"
    WHERE "id" = ${wishlistId} AND "householdId" = ${householdId}`
  if (!list) return { error: "Wishlist not found" }

  await sql`
    INSERT INTO "WishlistItem" (
      "wishlistId", "name", "lowPrice", "highPrice", "url", "sortOrder"
    ) VALUES (
      ${list.id}, ${input.name}, ${input.lowPrice}, ${input.highPrice},
      ${input.url},
      COALESCE((SELECT max("sortOrder") + 1 FROM "WishlistItem"
                WHERE "wishlistId" = ${list.id}), 0)
    )`
  return { ok: true }
}

export async function updateWishlistItem(
  householdId: string,
  id: string,
  input: WishlistItemInput
): Promise<void> {
  await sql`
    UPDATE "WishlistItem" i
    SET "name" = ${input.name}, "lowPrice" = ${input.lowPrice},
        "highPrice" = ${input.highPrice}, "url" = ${input.url},
        "updatedAt" = now()
    FROM "Wishlist" w
    WHERE i."wishlistId" = w."id"
      AND i."id" = ${id} AND w."householdId" = ${householdId}`
}

export async function toggleWishlistItemPurchased(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    UPDATE "WishlistItem" i
    SET "isPurchased" = NOT i."isPurchased", "updatedAt" = now()
    FROM "Wishlist" w
    WHERE i."wishlistId" = w."id"
      AND i."id" = ${id} AND w."householdId" = ${householdId}`
}

export async function deleteWishlistItem(
  householdId: string,
  id: string
): Promise<void> {
  await sql`
    DELETE FROM "WishlistItem" i
    USING "Wishlist" w
    WHERE i."wishlistId" = w."id"
      AND i."id" = ${id} AND w."householdId" = ${householdId}`
}
