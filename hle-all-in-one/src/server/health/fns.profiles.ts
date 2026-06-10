import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { healthMemberBelongsToHousehold, listActiveHealthMembers } from "./members"
import {
  createProfileRecord,
  deleteProfileRecord,
  listProfileRecords,
} from "./profiles"

const idSchema = z.object({ id: z.string().min(1) })

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

// Comma-separated form input → trimmed string array (legacy parsing).
const commaList = z
  .string()
  .max(2000)
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )

const BLOOD_TYPES = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
  "UNKNOWN",
] as const

const recordSchema = z.object({
  memberId: z.string().min(1),
  recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bloodType: z.enum(BLOOD_TYPES),
  heightCm: z.number().positive().max(999.99).nullable(),
  weightKg: z.number().positive().max(999.99).nullable(),
  allergies: commaList,
  chronicConditions: commaList,
  majorSurgeries: commaList,
  primaryCareProvider: optText,
  preferredHospital: optText,
  medicalNotes: optText,
  isOrganDonor: z.boolean(),
})

export const getHealthProfilesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, records] = await Promise.all([
      listActiveHealthMembers(context.householdId),
      listProfileRecords(context.householdId),
    ])
    return { members, records }
  })

export const createProfileRecordFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => recordSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { memberId, ...input } = data
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      memberId
    )
    if (!owned) return { error: "Member not found." }
    await createProfileRecord(memberId, input)
    return { ok: true as const }
  })

export const deleteProfileRecordFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteProfileRecord(context.householdId, data.id)
    if (!deleted) return { error: "Record not found." }
    return { ok: true as const }
  })
