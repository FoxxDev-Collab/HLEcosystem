// Receipt scanner fns. The image is read client-side into base64 and parsed
// by the internal AI gateway (see claude-api.ts). When the gateway env vars
// are unset, scanning returns { error: "AI features not configured" }.
// Committing a receipt can optionally mirror the total into the finance
// module ("Also add expense to Family Finance", legacy finance-bridge).
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { isAiConfigured, parseReceipt } from "./claude-api"
import {
  getStoreName,
  processReceiptItems,
  storeBelongsToHousehold,
} from "./receipts"
import { listActiveStores } from "./shopping-lists"
import { listAccountsForPicker } from "@/server/finance/accounts"
import { listCategoriesForPicker } from "@/server/finance/categories"
import { createTransaction } from "@/server/finance/transactions"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 25 MB binary ≈ 34 MB base64.
const MAX_BASE64_LENGTH = 34 * 1024 * 1024

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export const getReceiptsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [stores, financeAccounts, financeCategories] = await Promise.all([
      listActiveStores(context.householdId),
      listAccountsForPicker(context.householdId),
      listCategoriesForPicker(context.householdId),
    ])
    return {
      stores,
      aiConfigured: isAiConfigured(),
      financeAccounts,
      financeCategories: financeCategories.filter((c) => c.type === "EXPENSE"),
    }
  })

export const scanReceiptFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        image: z.string().min(1).max(MAX_BASE64_LENGTH),
        mimeType: z.string().refine((v) => ALLOWED_TYPES.includes(v), {
          message: "Unsupported file type. Use JPEG, PNG, WebP, or GIF.",
        }),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    if (!isAiConfigured()) {
      return { error: "AI features not configured" }
    }
    const result = await parseReceipt(data.image, data.mimeType)
    if (!result.success || !result.data) {
      return { error: result.error ?? "Failed to parse receipt" }
    }
    return { data: result.data }
  })

const receiptItemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  price: z.number().min(0).max(1000000),
  category: z.string().max(200),
})

export const processReceiptFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        storeId: z.string().regex(UUID_RE),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        items: z.array(receiptItemSchema).min(1).max(300),
        // Optional "Also add expense to Family Finance" hand-off. total is
        // the scanned receipt total (includes tax — item sum would miss it).
        finance: z
          .object({
            accountId: z.string().min(1),
            categoryId: z.string().min(1).nullable(),
            total: z.number().positive().max(1000000),
          })
          .nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    // Re-verify the store belongs to this household (ADR-0005).
    const owned = await storeBelongsToHousehold(
      context.householdId,
      data.storeId
    )
    if (!owned) return { error: "Store not found." }

    const recorded = await processReceiptItems(
      context.householdId,
      data.storeId,
      data.date,
      data.items
    )

    // Optional finance mirror. Price observations above are the source of
    // truth — a finance failure is reported as a warning, not a rollback
    // (matches legacy ordering). createTransaction re-verifies account and
    // category ownership (ADR-0005); the account balance is trigger-owned.
    if (data.finance) {
      const storeName = await getStoreName(context.householdId, data.storeId)
      const itemSummary = data.items.map((i) => i.name).join(", ")
      const description =
        itemSummary.length > 200
          ? `${itemSummary.substring(0, 197)}...`
          : itemSummary
      const result = await createTransaction(
        context.householdId,
        context.user.id,
        {
          type: "EXPENSE",
          accountId: data.finance.accountId,
          categoryId: data.finance.categoryId,
          amount: data.finance.total,
          date: data.date,
          payee: storeName ?? "Grocery Store",
          description,
          transferToAccountId: null,
        }
      )
      if ("error" in result) {
        return {
          ok: true as const,
          recorded,
          financeWarning: `Receipt recorded, but the finance sync failed: ${result.error}`,
        }
      }
    }
    return { ok: true as const, recorded }
  })
