// Receipt scanner fns. The image is read client-side into base64; the server
// decodes it and runs the shared magic-byte validation (lib/file-validation)
// before anything is sent to the AI gateway — the client-reported mimeType is
// never trusted. When the gateway env vars are unset, scanning returns
// { error: "AI gateway not configured" }.
import { Buffer } from "node:buffer"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { validateUpload } from "@/lib/file-validation"
import {
  AI_NOT_CONFIGURED_ERROR,
  categorizeTransaction,
  isAiConfigured,
  parseReceipt,
} from "./claude-api"
import { listAccountsForPicker } from "./accounts"
import { listCategoriesForPicker } from "./categories"
import {
  createTransactionFromReceipt,
  listExpenseCategoryNames,
} from "./receipts"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 25 MB binary ≈ 34 MB base64.
const MAX_BASE64_LENGTH = 34 * 1024 * 1024

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

export const getReceiptsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [accounts, categories] = await Promise.all([
      listAccountsForPicker(context.householdId),
      listCategoriesForPicker(context.householdId),
    ])
    return {
      accounts,
      categories: categories.filter((c) => c.type === "EXPENSE"),
      aiConfigured: isAiConfigured(),
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
      return { error: AI_NOT_CONFIGURED_ERROR }
    }

    // Magic-byte check on the decoded bytes — the detected MIME must itself
    // be an allowed image type, regardless of what the client claimed.
    const buffer = new Uint8Array(Buffer.from(data.image, "base64"))
    const validation = validateUpload({
      name: `receipt${MIME_EXT[data.mimeType] ?? ".bin"}`,
      size: buffer.length,
      buffer,
      type: data.mimeType,
    })
    if (!validation.valid) {
      return { error: validation.error }
    }
    if (!ALLOWED_TYPES.includes(validation.detectedMime)) {
      return { error: "File content is not a supported image format." }
    }

    const result = await parseReceipt(data.image, validation.detectedMime)
    if (!result.success || !result.data) {
      return { error: result.error ?? "Failed to parse receipt" }
    }
    return { data: result.data }
  })

// AI category suggestion for the scanned receipt. The candidate category
// names come from the household's own categories (server-side query) — never
// from the client.
export const suggestReceiptCategoryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        store: z.string().trim().min(1).max(200),
        itemSummary: z.string().max(2000),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    if (!isAiConfigured()) {
      return { error: AI_NOT_CONFIGURED_ERROR }
    }
    const categoryNames = await listExpenseCategoryNames(context.householdId)
    if (categoryNames.length === 0) {
      return { error: "No expense categories to suggest from" }
    }
    const description = `Receipt from ${data.store}: ${data.itemSummary}`
    const result = await categorizeTransaction(
      description,
      data.store,
      undefined,
      categoryNames
    )
    if (!result.success || !result.data) {
      return { error: result.error ?? "Suggestion failed" }
    }
    return { suggestion: result.data }
  })

const receiptItemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  price: z.number().min(0).max(1000000),
  category: z.string().max(200),
})

export const createTransactionFromReceiptFn = createServerFn({
  method: "POST",
})
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().regex(UUID_RE),
        categoryId: z.string().regex(UUID_RE).nullable(),
        store: z.string().trim().min(1).max(300),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        total: z.number().positive().max(100000000),
        items: z.array(receiptItemSchema).max(300),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    createTransactionFromReceipt(context.householdId, context.user.id, data)
  )
