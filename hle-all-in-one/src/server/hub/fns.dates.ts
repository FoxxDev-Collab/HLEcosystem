import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createImportantDate,
  deleteImportantDate,
  listAllDateEvents,
  listMemberOptions,
  listOpenTodoDueDates,
  updateImportantDate,
} from "./dates"

export const getDatesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [dates, members] = await Promise.all([
      listAllDateEvents(context.householdId),
      listMemberOptions(context.householdId),
    ])
    return { dates, members }
  })

export const getCalendarPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [dates, todos] = await Promise.all([
      listAllDateEvents(context.householdId),
      listOpenTodoDueDates(context.householdId),
    ])
    return { dates, todos }
  })

const dateSchema = z.object({
  label: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum([
    "BIRTHDAY",
    "ANNIVERSARY",
    "GRADUATION",
    "MEMORIAL",
    "HOLIDAY",
    "CUSTOM",
  ]),
  recurrenceType: z.enum(["ONCE", "ANNUAL"]).default("ANNUAL"),
  // Legacy behavior: parseInt(...) || 14 — blank/invalid (and 0) fall back
  // to the 14-day default.
  reminderDaysBefore: z.coerce
    .number()
    .int()
    .min(0)
    .catch(14)
    .transform((v) => v || 14),
  familyMemberId: z
    .string()
    .nullable()
    .transform((v) => v || null),
  notes: z
    .string()
    .max(2000)
    .nullable()
    .transform((v) => v || null),
})

export const createImportantDateFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => dateSchema.parse(d))
  .handler(async ({ data, context }) => {
    return createImportantDate(context.householdId, data)
  })

export const updateImportantDateFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    dateSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    return updateImportantDate(context.householdId, id, input)
  })

export const deleteImportantDateFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteImportantDate(context.householdId, data.id)
    return { ok: true as const }
  })
