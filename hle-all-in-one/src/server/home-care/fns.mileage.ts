import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listActiveVehicleOptions } from "./vehicles"
import {
  createMileageEntry,
  deleteMileageEntry,
  listRecentMileageEntries,
} from "./mileage"

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const entrySchema = z.object({
  vehicleId: z.string().min(1).max(64),
  mileage: z
    .string()
    .trim()
    .regex(/^\d+$/, "Invalid odometer reading")
    .transform((v) => parseInt(v, 10)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  notes: optText,
})

const idSchema = z.object({ id: z.string().min(1) })

export const getMileagePageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [vehicles, entries] = await Promise.all([
      listActiveVehicleOptions(context.householdId),
      listRecentMileageEntries(context.householdId),
    ])
    return { vehicles, entries }
  })

export const createMileageEntryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => entrySchema.parse(d))
  .handler(async ({ data, context }) => {
    const created = await createMileageEntry(
      context.householdId,
      data.vehicleId,
      data.mileage,
      data.date,
      data.notes
    )
    if (!created) return { error: "Vehicle not found." }
    return { ok: true as const }
  })

export const deleteMileageEntryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteMileageEntry(context.householdId, data.id)
    if (!deleted) return { error: "Entry not found." }
    return { ok: true as const }
  })
