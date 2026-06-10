// Receipt processing: AI-parsed receipt items become products + price
// observations ("StorePrice"). There is no persisted Receipt table — the
// scan result lives in the client until the user commits it (same as the
// legacy app).
//
// The optional "Also add expense to Family Finance" hand-off from the legacy
// app is wired up in fns.receipts.ts via the in-process finance module (the
// legacy cross-schema lib/finance-bridge.ts is obsolete — the balance is now
// owned by the sync_account_balance trigger, so only the INSERT happens).
import { sql } from "@/server/db"
import { findProductByName } from "./ingredients"

export type ReceiptItemInput = {
  name: string
  price: number
  category: string
}

export async function storeBelongsToHousehold(
  householdId: string,
  storeId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Store"
    WHERE "id" = ${storeId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// Scoped name lookup for the finance hand-off's transaction payee.
export async function getStoreName(
  householdId: string,
  storeId: string
): Promise<string | null> {
  const rows = await sql<Array<{ name: string }>>`
    SELECT "name" FROM "Store"
    WHERE "id" = ${storeId} AND "householdId" = ${householdId}`
  return rows[0]?.name ?? null
}

// Find-or-create the product for a receipt line; new products get the
// receipt's category when a "ProductCategory" with that name already exists
// (legacy rule: categories are matched, never auto-created here).
async function productForReceiptItem(
  householdId: string,
  item: ReceiptItemInput,
  categoryLookup: Map<string, string>
): Promise<string> {
  const existing = await findProductByName(householdId, item.name)
  if (existing) return existing.id

  const categoryId =
    categoryLookup.get(item.category.toLowerCase().trim()) ?? null
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Product" ("householdId", "name", "categoryId", "defaultUnit")
    VALUES (${householdId}, ${item.name}, ${categoryId}, 'EACH')
    RETURNING "id"`
  return rows[0].id
}

export async function processReceiptItems(
  householdId: string,
  storeId: string,
  receiptDate: string,
  items: Array<ReceiptItemInput>
): Promise<number> {
  const categories = await sql<Array<{ id: string; name: string }>>`
    SELECT "id", "name" FROM "ProductCategory"
    WHERE "householdId" = ${householdId}`
  const categoryLookup = new Map(
    categories.map((c) => [c.name.toLowerCase().trim(), c.id])
  )

  let recorded = 0
  for (const item of items) {
    const productId = await productForReceiptItem(
      householdId,
      item,
      categoryLookup
    )
    await sql`
      INSERT INTO "StorePrice" ("productId", "storeId", "price", "observedAt")
      VALUES (${productId}, ${storeId}, ${item.price}, ${receiptDate})`
    recorded++
  }
  return recorded
}
