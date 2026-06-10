// Receipt processing: AI-parsed receipt items become products + price
// observations ("StorePrice"). There is no persisted Receipt table — the
// scan result lives in the client until the user commits it (same as the
// legacy app).
//
// TODO(finance): the legacy app could also write an EXPENSE transaction into
// family_finance via lib/finance-bridge.ts ("Also add expense to Family
// Finance"). The finance module has not been ported into hle-all-in-one yet —
// re-add that hand-off (account/category pickers + transaction insert +
// balance update) once finance lands. Deliberately NOT ported now.
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
