import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createMedication,
  deleteMedication,
  healthMemberBelongsToHousehold,
  listActiveHealthMembers,
  listMedications,
  recordRefill,
  toggleMedicationActive,
} from "./medications"

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

const idSchema = z.object({ id: z.string().min(1) })

export const getMedicationsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, medications] = await Promise.all([
      listActiveHealthMembers(context.householdId),
      listMedications(context.householdId),
    ])
    return { members, medications }
  })

const medicationSchema = z.object({
  memberId: z.string().min(1),
  medicationName: z.string().trim().min(1).max(200),
  dosage: optText,
  frequency: optText,
  prescribedBy: optText,
  pharmacy: optText,
  purpose: optText,
  startDate: optDate,
  nextRefillDate: optDate,
  refillsRemaining: z.number().int().min(0).max(1000).nullable(),
  costPerRefill: z.number().nonnegative().max(99999999).nullable(),
  paidFromHsa: z.boolean(),
})

export const createMedicationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => medicationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { memberId, ...input } = data
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      memberId
    )
    if (!owned) return { error: "Family member not found." }
    await createMedication(memberId, input)
    return { ok: true as const }
  })

export const toggleMedicationActiveFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await toggleMedicationActive(context.householdId, data.id)
    if (!toggled) return { error: "Medication not found." }
    return { ok: true as const }
  })

export const recordRefillFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const refilled = await recordRefill(context.householdId, data.id)
    if (!refilled) return { error: "Medication not found." }
    return { ok: true as const }
  })

export const deleteMedicationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteMedication(context.householdId, data.id)
    if (!deleted) return { error: "Medication not found." }
    return { ok: true as const }
  })
