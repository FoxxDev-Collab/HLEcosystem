import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createMaintenanceLog,
  deleteMaintenanceLog,
  listMaintenanceLogs,
} from "./maintenance-logs"
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

export const getMaintenanceLogPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        itemId: z.string().regex(UUID_RE).nullable(),
        vehicleId: z.string().regex(UUID_RE).nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const [logs, items, vehicles] = await Promise.all([
      listMaintenanceLogs(context.householdId, data.itemId, data.vehicleId),
      listItemOptions(context.householdId),
      listVehicleOptions(context.householdId),
    ])
    return { logs, items, vehicles }
  })

export const createMaintenanceLogFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        description: optText,
        itemId: optUuid,
        vehicleId: optUuid,
        completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        completedBy: optText,
        cost: z.number().nonnegative().max(99999999).nullable(),
        mileageAtService: z.number().int().positive().max(10000000).nullable(),
        partsUsed: optText,
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await createMaintenanceLog(context.householdId, data)
    return { ok: true as const }
  })

export const deleteMaintenanceLogFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().regex(UUID_RE) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const deleted = await deleteMaintenanceLog(context.householdId, data.id)
    if (!deleted) return { error: "Log entry not found." }
    return { ok: true as const }
  })
