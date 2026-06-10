import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointmentStatus,
} from "./appointments"
import {
  healthMemberBelongsToHousehold,
  listActiveHealthMembers,
} from "./members"
import {
  listActiveProviderOptions,
  providerBelongsToHousehold,
} from "./providers"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const idSchema = z.object({ id: z.string().min(1) })

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const APPOINTMENT_TYPES = [
  "ANNUAL_CHECKUP",
  "FOLLOW_UP",
  "SPECIALIST",
  "PROCEDURE",
  "LAB_WORK",
  "DENTAL",
  "VISION",
  "URGENT_CARE",
  "TELEHEALTH",
  "OTHER",
] as const

const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
] as const

const createSchema = z.object({
  memberId: z.string().min(1),
  providerId: z
    .string()
    .transform((v) => v || null)
    .nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(5).max(1440),
  appointmentType: z.enum(APPOINTMENT_TYPES),
  location: optText,
  reasonForVisit: optText,
})

export const getHealthAppointmentsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ memberId: z.string().nullable() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const memberId =
      data.memberId && UUID_RE.test(data.memberId) ? data.memberId : null
    const [members, providers, appointments] = await Promise.all([
      listActiveHealthMembers(context.householdId),
      listActiveProviderOptions(context.householdId),
      listAppointments(context.householdId, memberId),
    ])
    return { members, providers, appointments }
  })

export const createAppointmentFn = createServerFn({ method: "POST" })
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
    await createAppointment(data.memberId, {
      providerId: data.providerId,
      appointmentDateTime: new Date(`${data.date}T${data.time}`),
      durationMinutes: data.durationMinutes,
      appointmentType: data.appointmentType,
      location: data.location,
      reasonForVisit: data.reasonForVisit,
    })
    return { ok: true as const }
  })

export const updateAppointmentStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().min(1), status: z.enum(APPOINTMENT_STATUSES) })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await updateAppointmentStatus(
      context.householdId,
      data.id,
      data.status
    )
    if (!updated) return { error: "Appointment not found." }
    return { ok: true as const }
  })

export const deleteAppointmentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteAppointment(context.householdId, data.id)
    if (!deleted) return { error: "Appointment not found." }
    return { ok: true as const }
  })
