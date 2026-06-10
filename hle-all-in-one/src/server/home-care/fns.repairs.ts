import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createRepair,
  deleteRepair,
  listProviderOptions,
  listRepairs,
  updateRepair,
  updateRepairStatus,
} from "./repairs"
import { listItemOptions, listVehicleOptions } from "./schedules"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

const optUuid = z
  .string()
  .max(40)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || UUID_RE.test(v), { message: "Invalid id" })

const statusSchema = z.enum([
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
])

const repairSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optText,
  itemId: optUuid,
  vehicleId: optUuid,
  providerId: optUuid,
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledDate: optDate,
  completedBy: optText,
  laborCost: z.number().nonnegative().max(99999999).nullable(),
  partsCost: z.number().nonnegative().max(99999999).nullable(),
  warrantyClaimId: optText,
  partsUsed: optText,
  notes: optText,
})

export const getRepairsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [repairs, items, vehicles, providers] = await Promise.all([
      listRepairs(context.householdId),
      listItemOptions(context.householdId),
      listVehicleOptions(context.householdId),
      listProviderOptions(context.householdId),
    ])
    return { repairs, items, vehicles, providers }
  })

export const createRepairFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => repairSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createRepair(context.householdId, data)
    return { ok: true as const }
  })

export const updateRepairStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().regex(UUID_RE), status: statusSchema }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await updateRepairStatus(
      context.householdId,
      data.id,
      data.status
    )
    if (!updated) return { error: "Repair not found." }
    return { ok: true as const }
  })

export const updateRepairFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    repairSchema
      .extend({
        id: z.string().regex(UUID_RE),
        status: statusSchema,
        completedDate: optDate,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    const updated = await updateRepair(context.householdId, id, input)
    if (!updated) return { error: "Repair not found." }
    return { ok: true as const }
  })

export const deleteRepairFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().regex(UUID_RE) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const deleted = await deleteRepair(context.householdId, data.id)
    if (!deleted) return { error: "Repair not found." }
    return { ok: true as const }
  })
