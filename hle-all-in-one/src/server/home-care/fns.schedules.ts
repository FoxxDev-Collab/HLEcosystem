import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  completeSchedule,
  createSchedule,
  deleteSchedule,
  listItemOptions,
  listSchedules,
  listVehicleOptions,
  updateSchedule,
} from "./schedules"

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

const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// Empty string from a <select> means "no link".
const optUuid = z
  .string()
  .max(40)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || UUID_RE.test(v), { message: "Invalid id" })

const frequencySchema = z.enum([
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUALLY",
  "ANNUALLY",
  "CUSTOM_DAYS",
])

const scheduleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optText,
  itemId: optUuid,
  vehicleId: optUuid,
  frequency: frequencySchema,
  customIntervalDays: z.number().int().positive().max(3650).nullable(),
  nextDueDate: optDate,
  estimatedCost: z.number().nonnegative().max(99999999).nullable(),
  assignedTo: optText,
})

const idSchema = z.object({ id: z.string().regex(UUID_RE) })

export const getSchedulesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [schedules, items, vehicles] = await Promise.all([
      listSchedules(context.householdId),
      listItemOptions(context.householdId),
      listVehicleOptions(context.householdId),
    ])
    return { schedules, items, vehicles }
  })

export const createScheduleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => scheduleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createSchedule(context.householdId, data)
    return { ok: true as const }
  })

export const updateScheduleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    scheduleSchema
      .extend({ id: z.string().regex(UUID_RE), isActive: z.boolean() })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    const updated = await updateSchedule(context.householdId, id, input)
    if (!updated) return { error: "Schedule not found." }
    return { ok: true as const }
  })

export const completeScheduleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        scheduleId: z.string().regex(UUID_RE),
        completedDate: reqDate,
        completedBy: optText,
        cost: z.number().nonnegative().max(99999999).nullable(),
        mileageAtService: z.number().int().positive().max(10000000).nullable(),
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { scheduleId, ...input } = data
    const completed = await completeSchedule(
      context.householdId,
      scheduleId,
      input
    )
    if (!completed) return { error: "Schedule not found." }
    return { ok: true as const }
  })

export const deleteScheduleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteSchedule(context.householdId, data.id)
    if (!deleted) return { error: "Schedule not found." }
    return { ok: true as const }
  })
