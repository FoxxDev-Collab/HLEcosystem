import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  healthMemberBelongsToHousehold,
  listActiveHealthMembers,
} from "./medications"
import {
  createHealthEmergencyContact,
  deleteHealthEmergencyContact,
  listHealthEmergencyContacts,
} from "./emergency-contacts"

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const idSchema = z.object({ id: z.string().min(1) })

export const getEmergencyContactsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, contacts] = await Promise.all([
      listActiveHealthMembers(context.householdId),
      listHealthEmergencyContacts(context.householdId),
    ])
    return { members, contacts }
  })

const contactSchema = z.object({
  memberId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  relationship: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().min(1).max(50),
  alternatePhone: optText,
  email: optText,
  address: optText,
  priority: z.number().int().min(1).max(10),
})

export const createHealthEmergencyContactFn = createServerFn({
  method: "POST",
})
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { memberId, ...input } = data
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      memberId
    )
    if (!owned) return { error: "Family member not found." }
    await createHealthEmergencyContact(memberId, input)
    return { ok: true as const }
  })

export const deleteHealthEmergencyContactFn = createServerFn({
  method: "POST",
})
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteHealthEmergencyContact(
      context.householdId,
      data.id
    )
    if (!deleted) return { error: "Contact not found." }
    return { ok: true as const }
  })
