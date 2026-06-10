// Receipt scanner fns. The image is read client-side into base64 and parsed
// by the internal AI gateway (see claude-api.ts). When the gateway env vars
// are unset, scanning returns { error: "AI features not configured" }.
//
// TODO(finance): the legacy flow could also create an EXPENSE transaction in
// family_finance ("Also add expense to Family Finance"). The finance module
// is not in hle-all-in-one yet — wire that hand-off back up when it lands.
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { isAiConfigured, parseReceipt } from "./claude-api"
import { processReceiptItems, storeBelongsToHousehold } from "./receipts"
import { listActiveStores } from "./shopping-lists"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 25 MB binary ≈ 34 MB base64.
const MAX_BASE64_LENGTH = 34 * 1024 * 1024

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export const getReceiptsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const stores = await listActiveStores(context.householdId)
    return { stores, aiConfigured: isAiConfigured() }
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
    return { ok: true as const, recorded }
  })
