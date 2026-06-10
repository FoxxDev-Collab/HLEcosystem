// Receipt scanner → expense transaction (legacy receipts/actions.ts).
// The scan result lives in the client until the user commits it — there is
// no persisted receipt table (same as legacy). The final INSERT goes through
// createTransaction(), which re-verifies account and category ownership
// (ADR-0005) and leaves balances to the sync_account_balance DB trigger.
import { sql } from "@/server/db"
import { createTransaction } from "./transactions"

export type ReceiptItem = {
  name: string
  price: number
  category: string
}

export type ReceiptTransactionInput = {
  accountId: string
  categoryId: string | null
  store: string
  date: string
  total: number
  items: Array<ReceiptItem>
}

export async function createTransactionFromReceipt(
  householdId: string,
  userId: string,
  input: ReceiptTransactionInput
): Promise<{ ok: true } | { error: string }> {
  // One expense transaction for the receipt total; the description is the
  // item list truncated to 200 chars (legacy behavior).
  const itemSummary = input.items.map((i) => i.name).join(", ")
  const description =
    itemSummary.length > 200
      ? `${itemSummary.substring(0, 197)}...`
      : itemSummary

  return createTransaction(householdId, userId, {
    type: "EXPENSE",
    accountId: input.accountId,
    categoryId: input.categoryId,
    amount: Math.abs(input.total),
    date: input.date,
    payee: input.store,
    description: description || null,
    transferToAccountId: null,
  })
}

// Category names for the AI suggestion prompt — built ONLY from this
// household's categories, never from client input (prompt-injection /
// cross-tenant leak guard).
export async function listExpenseCategoryNames(
  householdId: string
): Promise<Array<string>> {
  const rows = await sql<Array<{ name: string }>>`
    SELECT "name" FROM "Category"
    WHERE "householdId" = ${householdId}
      AND "type" = 'EXPENSE'
      AND NOT "isArchived"
    ORDER BY "sortOrder" ASC, "name" ASC`
  return rows.map((r) => r.name)
}
