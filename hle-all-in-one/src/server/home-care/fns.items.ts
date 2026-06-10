import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listRoomOptions, roomBelongsToHousehold } from "./rooms"
import {
  archiveItem,
  createItem,
  deleteItem,
  getItem,
  listDocumentsForItem,
  listItems,
  listMaintenanceLogsForItem,
  listRepairsForItem,
  updateItem,
} from "./items"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const optDate = z
  .string()
  .max(10)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  })

const optMoney = z
  .string()
  .max(20)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Invalid amount",
  })
  .transform((v) => (v === null ? null : parseFloat(v)))

const optUuid = z
  .string()
  .max(64)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || UUID_RE.test(v), { message: "Invalid id" })

const itemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  roomId: optUuid,
  description: optText,
  manufacturer: optText,
  model: optText,
  serialNumber: optText,
  purchaseDate: optDate,
  purchasePrice: optMoney,
  purchasedFrom: optText,
  warrantyExpires: optDate,
  warrantyNotes: optText,
  condition: z.enum([
    "EXCELLENT",
    "GOOD",
    "FAIR",
    "POOR",
    "NEEDS_REPAIR",
    "DECOMMISSIONED",
  ]),
  manualUrl: optText,
  notes: optText,
})

const idSchema = z.object({ id: z.string().min(1) })

// ─── Items list page (also backs the warranties view) ───

export const getItemsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [items, rooms] = await Promise.all([
      listItems(context.householdId),
      listRoomOptions(context.householdId),
    ])
    return { items, rooms }
  })

// ─── Item detail page ────────────────────────────────────

export const getItemFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const item = await getItem(context.householdId, data.id)
    if (!item) return null
    const [rooms, maintenanceLogs, repairs, documents] = await Promise.all([
      listRoomOptions(context.householdId),
      listMaintenanceLogsForItem(context.householdId, item.id),
      listRepairsForItem(context.householdId, item.id),
      listDocumentsForItem(context.householdId, item.id),
    ])
    return { item, rooms, maintenanceLogs, repairs, documents }
  })

// ─── Mutations ───────────────────────────────────────────

export const createItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => itemSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.roomId) {
      const owned = await roomBelongsToHousehold(
        context.householdId,
        data.roomId
      )
      if (!owned) return { error: "Room not found." }
    }
    const id = await createItem(context.householdId, data)
    return { ok: true as const, id }
  })

export const updateItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    itemSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    if (input.roomId) {
      const owned = await roomBelongsToHousehold(
        context.householdId,
        input.roomId
      )
      if (!owned) return { error: "Room not found." }
    }
    const updated = await updateItem(context.householdId, id, input)
    if (!updated) return { error: "Item not found." }
    return { ok: true as const }
  })

export const archiveItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const archived = await archiveItem(context.householdId, data.id)
    if (!archived) return { error: "Item not found." }
    return { ok: true as const }
  })

export const deleteItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteItem(context.householdId, data.id)
    if (!deleted) return { error: "Item not found." }
    return { ok: true as const }
  })
