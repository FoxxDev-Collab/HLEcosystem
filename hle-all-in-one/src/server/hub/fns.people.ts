import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listMembers } from "@/server/households"
import {
  addAddress,
  addCareerEntry,
  createFamilyMember,
  deleteAddress,
  deleteCareerEntry,
  deleteFamilyMember,
  findMemberByLinkedUser,
  getFamilyMember,
  listActiveGiftIdeasForMember,
  listAddressesForMember,
  listCareerEntriesForMember,
  listCrossHouseholdRelatives,
  listFamilyMembers,
  listGiftsForMember,
  listHolidayCardMembers,
  listImportantDatesForMember,
  listRelationsFrom,
  listRelativeRelationships,
  memberBelongsToHousehold,
  syncMemberDates,
  toggleFamilyMemberActive,
  updateFamilyMember,
} from "./people"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

const memberSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  nickname: optText,
  relationshipNotes: optText,
  birthday: optDate,
  anniversary: optDate,
  phone: optText,
  email: optText,
  preferredContactMethod: z.enum(["NONE", "PHONE", "EMAIL", "TEXT"]),
  addressLine1: optText,
  addressLine2: optText,
  city: optText,
  state: optText,
  zipCode: optText,
  country: optText,
  notes: optText,
  includeInHolidayCards: z.boolean(),
})

const idSchema = z.object({ id: z.string().min(1) })

// ─── People list page ───────────────────────────────────

export const getPeoplePageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, householdMembers, relative, crossHousehold] =
      await Promise.all([
        listFamilyMembers(context.householdId),
        listMembers(context.householdId),
        listRelativeRelationships(context.householdId, context.user.id),
        listCrossHouseholdRelatives(context.householdId),
      ])
    const linkedUserIds = new Set(
      members.map((m) => m.linkedUserId).filter((id) => id !== null)
    )
    return {
      members,
      unlinkedHouseholdMembers: householdMembers
        .filter((hm) => !linkedUserIds.has(hm.userId))
        .map((hm) => ({
          userId: hm.userId,
          displayName: hm.displayName,
          email: hm.email,
        })),
      relative,
      crossHousehold,
      viewerUserId: context.user.id,
    }
  })

// ─── Person detail page ─────────────────────────────────

export const getPersonFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const member = await getFamilyMember(context.householdId, data.id)
    if (!member) return null
    const [
      addresses,
      careerEntries,
      relations,
      importantDates,
      gifts,
      giftIdeas,
      relative,
    ] = await Promise.all([
      listAddressesForMember(context.householdId, member.id),
      listCareerEntriesForMember(context.householdId, member.id),
      listRelationsFrom(context.householdId, member.id),
      listImportantDatesForMember(context.householdId, member.id),
      listGiftsForMember(context.householdId, member.id),
      listActiveGiftIdeasForMember(context.householdId, member.id),
      listRelativeRelationships(context.householdId, context.user.id),
    ])
    return {
      member,
      addresses,
      careerEntries,
      relations,
      importantDates,
      gifts,
      giftIdeas,
      relative,
      viewerUserId: context.user.id,
      householdId: context.householdId,
    }
  })

// ─── Address book page ──────────────────────────────────

export const getAddressBookFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listHolidayCardMembers(context.householdId))

// ─── Member mutations ───────────────────────────────────

export const createPersonFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => memberSchema.parse(d))
  .handler(async ({ data, context }) => {
    const id = await createFamilyMember(context.householdId, data)
    await syncMemberDates(
      context.householdId,
      id,
      data.firstName,
      data.lastName,
      data.birthday,
      data.anniversary
    )
    return { ok: true as const, id }
  })

export const updatePersonFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    memberSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    const updated = await updateFamilyMember(context.householdId, id, input)
    if (!updated) return { error: "Person not found." }
    await syncMemberDates(
      context.householdId,
      id,
      input.firstName,
      input.lastName,
      input.birthday,
      input.anniversary
    )
    return { ok: true as const }
  })

export const togglePersonActiveFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await toggleFamilyMemberActive(context.householdId, data.id)
    if (!toggled) return { error: "Person not found." }
    return { ok: true as const }
  })

export const deletePersonFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteFamilyMember(context.householdId, data.id)
    if (!deleted) return { error: "Person not found." }
    return { ok: true as const }
  })

// Adds a household member (an actual user account) to the People directory as
// a linked FamilyMember. Display name comes from the membership row — never
// from the client.
export const syncHouseholdMemberFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const membership = (await listMembers(context.householdId)).find(
      (m) => m.userId === data.userId
    )
    if (!membership) {
      return { error: "That user is not a member of this household." }
    }
    const existing = await findMemberByLinkedUser(
      context.householdId,
      data.userId
    )
    if (existing) return { ok: true as const, id: existing.id }

    const parts = membership.displayName.trim().split(" ")
    const firstName = parts[0] || membership.displayName
    const lastName = parts.slice(1).join(" ") || ""
    const id = await createFamilyMember(
      context.householdId,
      {
        firstName,
        lastName,
        nickname: null,
        relationshipNotes: null,
        birthday: null,
        anniversary: null,
        phone: null,
        email: null,
        preferredContactMethod: "NONE",
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        zipCode: null,
        country: null,
        notes: null,
        includeInHolidayCards: false,
      },
      data.userId
    )
    return { ok: true as const, id }
  })

// ─── Address mutations ──────────────────────────────────

const addressSchema = z.object({
  familyMemberId: z.string().min(1),
  label: optText,
  addressLine1: z.string().trim().min(1).max(300),
  addressLine2: optText,
  city: z.string().trim().min(1).max(120),
  state: optText,
  zipCode: optText,
  country: optText,
  isCurrent: z.boolean(),
  moveInDate: optDate,
  moveOutDate: optDate,
  notes: optText,
})

export const addAddressFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => addressSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { familyMemberId, ...input } = data
    const owned = await memberBelongsToHousehold(
      context.householdId,
      familyMemberId
    )
    if (!owned) return { error: "Person not found." }
    await addAddress(context.householdId, familyMemberId, input)
    return { ok: true as const }
  })

export const deleteAddressFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteAddress(context.householdId, data.id)
    if (!deleted) return { error: "Address not found." }
    return { ok: true as const }
  })

// ─── Career mutations ───────────────────────────────────

const careerSchema = z.object({
  familyMemberId: z.string().min(1),
  employer: z.string().trim().min(1).max(200),
  title: optText,
  department: optText,
  startDate: optDate,
  endDate: optDate,
  isCurrent: z.boolean(),
  location: optText,
  notes: optText,
})

export const addCareerEntryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => careerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { familyMemberId, ...input } = data
    const owned = await memberBelongsToHousehold(
      context.householdId,
      familyMemberId
    )
    if (!owned) return { error: "Person not found." }
    await addCareerEntry(context.householdId, familyMemberId, input)
    return { ok: true as const }
  })

export const deleteCareerEntryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteCareerEntry(context.householdId, data.id)
    if (!deleted) return { error: "Position not found." }
    return { ok: true as const }
  })
