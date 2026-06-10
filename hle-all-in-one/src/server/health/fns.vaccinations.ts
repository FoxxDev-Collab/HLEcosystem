import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  healthMemberBelongsToHousehold,
  listActiveHealthMembers,
} from "./medications"
import {
  createVaccination,
  deleteVaccination,
  listVaccinations,
} from "./vaccinations"

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

export const getVaccinationsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, vaccinations] = await Promise.all([
      listActiveHealthMembers(context.householdId),
      listVaccinations(context.householdId),
    ])
    return { members, vaccinations }
  })

const vaccinationSchema = z.object({
  memberId: z.string().min(1),
  vaccineName: z.string().trim().min(1).max(200),
  doseNumber: optText,
  dateAdministered: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextDoseDate: optDate,
  administeredBy: optText,
  lotNumber: optText,
  notes: optText,
})

export const createVaccinationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => vaccinationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { memberId, ...input } = data
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      memberId
    )
    if (!owned) return { error: "Family member not found." }
    await createVaccination(memberId, input)
    return { ok: true as const }
  })

export const deleteVaccinationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteVaccination(context.householdId, data.id)
    if (!deleted) return { error: "Vaccination not found." }
    return { ok: true as const }
  })
