import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createStore,
  deleteStore,
  listStores,
  storeNameTaken,
  updateStore,
} from "./stores"

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const storeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: optText,
  notes: optText,
  color: optText,
})

const idSchema = z.object({ id: z.string().min(1) })

export const getStoresPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listStores(context.householdId))

export const createStoreFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => storeSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (await storeNameTaken(context.householdId, data.name)) {
      return { error: `A store named "${data.name}" already exists.` }
    }
    await createStore(context.householdId, data)
    return { ok: true as const }
  })

export const updateStoreFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    storeSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    if (await storeNameTaken(context.householdId, input.name, id)) {
      return { error: `A store named "${input.name}" already exists.` }
    }
    const updated = await updateStore(context.householdId, id, input)
    if (!updated) return { error: "Store not found." }
    return { ok: true as const }
  })

export const deleteStoreFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteStore(context.householdId, data.id)
    if (!deleted) return { error: "Store not found." }
    return { ok: true as const }
  })
