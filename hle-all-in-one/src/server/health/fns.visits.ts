import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { getAppointmentMemberId } from "./appointments"
import {
  healthMemberBelongsToHousehold,
  listActiveHealthMembers,
} from "./members"
import {
  listActiveProviderOptions,
  providerBelongsToHousehold,
} from "./providers"
import {
  appointmentAlreadyLinked,
  createVisitSummary,
  deleteVisitSummary,
  listLinkableAppointments,
  listVisitSummaries,
} from "./visits"

const idSchema = z.object({ id: z.string().min(1) })

const optText = z
  .string()
  .max(5000)
  .transform((v) => v.trim() || null)

const optId = z
  .string()
  .transform((v) => v || null)
  .nullable()

const optMoney = z.number().min(0).max(99999999).nullable()

const VISIT_TYPES = [
  "IN_PERSON",
  "TELEHEALTH",
  "EMERGENCY",
  "HOSPITAL",
  "URGENT_CARE",
] as const

const createSchema = z.object({
  memberId: z.string().min(1),
  providerId: optId,
  appointmentId: optId,
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitType: z.enum(VISIT_TYPES),
  chiefComplaint: optText,
  diagnosis: optText,
  treatmentProvided: optText,
  prescriptionsWritten: optText,
  labTestsOrdered: optText,
  followUpInstructions: optText,
  notes: optText,
  billedAmount: optMoney,
  insurancePaid: optMoney,
  outOfPocketCost: optMoney,
  paidFromHsa: z.boolean(),
})

export const getHealthVisitsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, providers, visits, linkableAppointments] =
      await Promise.all([
        listActiveHealthMembers(context.householdId),
        listActiveProviderOptions(context.householdId),
        listVisitSummaries(context.householdId),
        listLinkableAppointments(context.householdId),
      ])
    return { members, providers, visits, linkableAppointments }
  })

export const createVisitSummaryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      data.memberId
    )
    if (!owned) return { error: "Member not found." }
    if (data.providerId) {
      const providerOwned = await providerBelongsToHousehold(
        context.householdId,
        data.providerId
      )
      if (!providerOwned) return { error: "Provider not found." }
    }
    if (data.appointmentId) {
      const apptMemberId = await getAppointmentMemberId(
        context.householdId,
        data.appointmentId
      )
      if (!apptMemberId) return { error: "Appointment not found." }
      if (apptMemberId !== data.memberId) {
        return { error: "That appointment belongs to a different member." }
      }
      // "appointmentId" is UNIQUE — a visit summary links 1:1.
      if (await appointmentAlreadyLinked(data.appointmentId)) {
        return {
          error: "That appointment is already linked to a visit summary.",
        }
      }
    }
    const { memberId, visitDate, ...rest } = data
    await createVisitSummary(memberId, {
      ...rest,
      visitDate: new Date(visitDate),
    })
    return { ok: true as const }
  })

export const deleteVisitSummaryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteVisitSummary(context.householdId, data.id)
    if (!deleted) return { error: "Visit summary not found." }
    return { ok: true as const }
  })
