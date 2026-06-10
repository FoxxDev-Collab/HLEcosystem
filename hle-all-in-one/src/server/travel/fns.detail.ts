import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listMembers } from "@/server/households"
import { tripBelongsToHousehold } from "./trips"
import {
  addPackingItem,
  addTraveler,
  createBudgetItem,
  createItineraryActivity,
  createItineraryDay,
  createPackingList,
  createReservation,
  createTravelContact,
  dayBelongsToHousehold,
  deleteBudgetItem,
  deleteItineraryActivity,
  deleteItineraryDay,
  deletePackingItem,
  deletePackingList,
  deleteReservation,
  deleteTravelContact,
  getTripDetail,
  packingListBelongsToHousehold,
  removeTraveler,
  togglePackingItem,
} from "./detail"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date" })

// <input type="datetime-local"> → "YYYY-MM-DDTHH:MM"; empty means NULL.
const optDateTime = z
  .string()
  .max(20)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v), {
    message: "Invalid date/time",
  })

const optCost = z.number().min(0).nullable()

const currencySchema = z.enum([
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "MXN",
  "CHF",
  "OTHER",
])

const idSchema = z.object({ id: z.string().min(1) })

// ─── Trip detail page (the tabbed hub) ──────────────────

export const getTripDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const detail = await getTripDetail(context.householdId, data.id)
    if (!detail) return null
    // Household members feed the traveler picker; Traveler.householdMemberId
    // stores the membershipId.
    const members = await listMembers(context.householdId)
    return {
      ...detail,
      members: members.map((m) => ({
        membershipId: m.membershipId,
        displayName: m.displayName,
      })),
    }
  })

// ─── Travelers ──────────────────────────────────────────

// Display name comes from the membership row — never from the client.
export const addTravelerFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        tripId: z.string().min(1),
        householdMemberId: z.string().min(1),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await tripBelongsToHousehold(context.householdId, data.tripId)
    if (!owned) return { error: "Trip not found." }
    const membership = (await listMembers(context.householdId)).find(
      (m) => m.membershipId === data.householdMemberId
    )
    if (!membership) {
      return { error: "That person is not a member of this household." }
    }
    return addTraveler(
      data.tripId,
      membership.membershipId,
      membership.displayName
    )
  })

export const removeTravelerFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const removed = await removeTraveler(context.householdId, data.id)
    if (!removed) return { error: "Traveler not found." }
    return { ok: true as const }
  })

// ─── Itinerary ──────────────────────────────────────────

export const createItineraryDayFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        tripId: z.string().min(1),
        date: dateStr,
        title: optText,
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await tripBelongsToHousehold(context.householdId, data.tripId)
    if (!owned) return { error: "Trip not found." }
    const { tripId, ...input } = data
    return createItineraryDay(tripId, input)
  })

export const deleteItineraryDayFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteItineraryDay(context.householdId, data.id)
    if (!deleted) return { error: "Day not found." }
    return { ok: true as const }
  })

export const createItineraryActivityFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        itineraryDayId: z.string().min(1),
        title: z.string().trim().min(1).max(200),
        startTime: optText,
        endTime: optText,
        location: optText,
        address: optText,
        bookingRef: optText,
        cost: optCost,
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await dayBelongsToHousehold(
      context.householdId,
      data.itineraryDayId
    )
    if (!owned) return { error: "Day not found." }
    const { itineraryDayId, ...input } = data
    await createItineraryActivity(itineraryDayId, input)
    return { ok: true as const }
  })

export const deleteItineraryActivityFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteItineraryActivity(context.householdId, data.id)
    if (!deleted) return { error: "Activity not found." }
    return { ok: true as const }
  })

// ─── Reservations ───────────────────────────────────────

export const createReservationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        tripId: z.string().min(1),
        type: z.enum([
          "FLIGHT",
          "HOTEL",
          "CAR_RENTAL",
          "RESTAURANT",
          "ACTIVITY",
          "TRAIN",
          "BUS",
          "FERRY",
          "CRUISE",
          "OTHER",
        ]),
        providerName: z.string().trim().min(1).max(200),
        confirmationNumber: optText,
        startDateTime: optDateTime,
        endDateTime: optDateTime,
        location: optText,
        departureLocation: optText,
        arrivalLocation: optText,
        cost: optCost,
        currency: currencySchema,
        bookingUrl: optText,
        contactPhone: optText,
        contactEmail: optText,
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await tripBelongsToHousehold(context.householdId, data.tripId)
    if (!owned) return { error: "Trip not found." }
    const { tripId, ...input } = data
    await createReservation(tripId, input)
    return { ok: true as const }
  })

export const deleteReservationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteReservation(context.householdId, data.id)
    if (!deleted) return { error: "Reservation not found." }
    return { ok: true as const }
  })

// ─── Packing ────────────────────────────────────────────

export const createPackingListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        tripId: z.string().min(1),
        name: z.string().trim().min(1).max(200),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await tripBelongsToHousehold(context.householdId, data.tripId)
    if (!owned) return { error: "Trip not found." }
    await createPackingList(data.tripId, data.name)
    return { ok: true as const }
  })

export const deletePackingListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePackingList(context.householdId, data.id)
    if (!deleted) return { error: "List not found." }
    return { ok: true as const }
  })

export const addPackingItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        packingListId: z.string().min(1),
        name: z.string().trim().min(1).max(200),
        category: z.enum([
          "CLOTHING",
          "TOILETRIES",
          "ELECTRONICS",
          "DOCUMENTS",
          "MEDICATIONS",
          "ACCESSORIES",
          "GEAR",
          "SNACKS",
          "OTHER",
        ]),
        quantity: z.number().int().min(1).max(999),
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await packingListBelongsToHousehold(
      context.householdId,
      data.packingListId
    )
    if (!owned) return { error: "List not found." }
    const { packingListId, ...input } = data
    await addPackingItem(packingListId, input)
    return { ok: true as const }
  })

export const togglePackingItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await togglePackingItem(context.householdId, data.id)
    if (!toggled) return { error: "Item not found." }
    return { ok: true as const }
  })

export const deletePackingItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePackingItem(context.householdId, data.id)
    if (!deleted) return { error: "Item not found." }
    return { ok: true as const }
  })

// ─── Budget ─────────────────────────────────────────────

export const createBudgetItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        tripId: z.string().min(1),
        category: z.enum([
          "FLIGHTS",
          "ACCOMMODATION",
          "TRANSPORTATION",
          "FOOD_AND_DRINK",
          "ACTIVITIES",
          "SHOPPING",
          "INSURANCE",
          "VISA_AND_FEES",
          "COMMUNICATION",
          "OTHER",
        ]),
        description: z.string().trim().min(1).max(300),
        plannedAmount: z.number().min(0),
        actualAmount: optCost,
        currency: currencySchema,
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await tripBelongsToHousehold(context.householdId, data.tripId)
    if (!owned) return { error: "Trip not found." }
    const { tripId, ...input } = data
    await createBudgetItem(tripId, input)
    return { ok: true as const }
  })

export const deleteBudgetItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteBudgetItem(context.householdId, data.id)
    if (!deleted) return { error: "Budget item not found." }
    return { ok: true as const }
  })

// ─── Contacts ───────────────────────────────────────────

export const createTravelContactFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        tripId: z.string().min(1),
        name: z.string().trim().min(1).max(200),
        role: optText,
        phone: optText,
        email: optText,
        address: optText,
        website: optText,
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await tripBelongsToHousehold(context.householdId, data.tripId)
    if (!owned) return { error: "Trip not found." }
    const { tripId, ...input } = data
    await createTravelContact(tripId, input)
    return { ok: true as const }
  })

export const deleteTravelContactFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteTravelContact(context.householdId, data.id)
    if (!deleted) return { error: "Contact not found." }
    return { ok: true as const }
  })
