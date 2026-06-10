import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  deleteDocument,
  getDocument,
  listDocuments,
  listRepairOptions,
  updateDocument,
} from "./documents"
import { listItemOptions, listVehicleOptions } from "./schedules"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const optUuid = z
  .string()
  .max(40)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || UUID_RE.test(v), { message: "Invalid id" })

const docTypeSchema = z.enum([
  "MANUAL",
  "WARRANTY",
  "RECEIPT",
  "INVOICE",
  "PHOTO",
  "OTHER",
])

export const getDocumentsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [documents, items, vehicles] = await Promise.all([
      listDocuments(context.householdId),
      listItemOptions(context.householdId),
      listVehicleOptions(context.householdId),
    ])
    return { documents, items, vehicles }
  })

export const getDocumentDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const document = await getDocument(context.householdId, data.id)
    if (!document) return null
    const [items, vehicles, repairs] = await Promise.all([
      listItemOptions(context.householdId),
      listVehicleOptions(context.householdId),
      listRepairOptions(context.householdId),
    ])
    return { document, items, vehicles, repairs }
  })

export const updateDocumentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().regex(UUID_RE),
        name: z.string().trim().min(1).max(255),
        type: docTypeSchema,
        notes: optText,
        itemId: optUuid,
        vehicleId: optUuid,
        repairId: optUuid,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    const updated = await updateDocument(context.householdId, id, input)
    if (!updated) return { error: "Document not found." }
    return { ok: true as const }
  })

export const deleteDocumentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().regex(UUID_RE) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const deleted = await deleteDocument(context.householdId, data.id)
    if (!deleted) return { error: "Document not found." }
    return { ok: true as const }
  })
