// Bank import fns. The statement file is read client-side as TEXT (CSV/OFX
// are text formats) and parsed 100% server-side by import-parser.ts; the zod
// gate bounds the payload size before any work happens.
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listAccountsForPicker } from "./accounts"
import { parseGenericCSV, parseOFX, parseWellsFargoCSV } from "./import-parser"
import {
  createImportBatch,
  finalizeImportBatch,
  getImportBatch,
  listImportBatches,
  skipImportedTransaction,
} from "./import"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 5 MB of statement text — far above any real bank export.
const MAX_FILE_TEXT_LENGTH = 5 * 1024 * 1024

const uploadSchema = z.object({
  accountId: z.string().regex(UUID_RE),
  fileName: z.string().trim().min(1).max(255),
  format: z.enum(["WELLS_FARGO", "GENERIC", "OFX"]),
  content: z.string().min(1).max(MAX_FILE_TEXT_LENGTH),
})

export const getImportPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [accounts, batches] = await Promise.all([
      listAccountsForPicker(context.householdId),
      listImportBatches(context.householdId),
    ])
    return { accounts, batches }
  })

export const getImportBatchFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().regex(UUID_RE) }).parse(d)
  )
  .handler(async ({ data, context }) =>
    getImportBatch(context.householdId, data.id)
  )

export const uploadImportFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => uploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Parse based on the user-selected format (legacy behavior).
    const parsed =
      data.format === "WELLS_FARGO"
        ? parseWellsFargoCSV(data.content)
        : data.format === "OFX"
          ? parseOFX(data.content)
          : parseGenericCSV(data.content)
    // Storage format: OFX/QFX share the OFX parser; everything else is CSV.
    const fileFormat = data.format === "OFX" ? "OFX" : "CSV"

    return createImportBatch(context.householdId, context.user.id, {
      accountId: data.accountId,
      fileName: data.fileName,
      format: fileFormat,
      parsed,
    })
  })

export const skipImportedTransactionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().regex(UUID_RE) }).parse(d)
  )
  .handler(async ({ data, context }) =>
    skipImportedTransaction(context.householdId, data.id)
  )

export const finalizeImportBatchFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ batchId: z.string().regex(UUID_RE) }).parse(d)
  )
  .handler(async ({ data, context }) =>
    finalizeImportBatch(context.householdId, context.user.id, data.batchId)
  )
