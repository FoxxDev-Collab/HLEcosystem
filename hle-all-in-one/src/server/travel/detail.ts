import { sql } from "@/server/db"
import type { TripRow } from "./trips"

export type TravelCurrency =
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "AUD"
  | "JPY"
  | "CNY"
  | "MXN"
  | "CHF"
  | "OTHER"

export type ReservationType =
  | "FLIGHT"
  | "HOTEL"
  | "CAR_RENTAL"
  | "RESTAURANT"
  | "ACTIVITY"
  | "TRAIN"
  | "BUS"
  | "FERRY"
  | "CRUISE"
  | "OTHER"

export type ReservationStatus =
  "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"

export type PackingCategory =
  | "CLOTHING"
  | "TOILETRIES"
  | "ELECTRONICS"
  | "DOCUMENTS"
  | "MEDICATIONS"
  | "ACCESSORIES"
  | "GEAR"
  | "SNACKS"
  | "OTHER"

export type TravelBudgetCategory =
  | "FLIGHTS"
  | "ACCOMMODATION"
  | "TRANSPORTATION"
  | "FOOD_AND_DRINK"
  | "ACTIVITIES"
  | "SHOPPING"
  | "INSURANCE"
  | "VISA_AND_FEES"
  | "COMMUNICATION"
  | "OTHER"

export type TravelerRow = {
  id: string
  tripId: string
  householdMemberId: string
  displayName: string
}

export type ItineraryActivityRow = {
  id: string
  itineraryDayId: string
  title: string
  startTime: string | null
  endTime: string | null
  location: string | null
  address: string | null
  bookingRef: string | null
  cost: number | null
  currency: TravelCurrency
  notes: string | null
  sortOrder: number
}

export type ItineraryDayRow = {
  id: string
  tripId: string
  date: string
  title: string | null
  notes: string | null
  sortOrder: number
}

export type ItineraryDayWithActivities = ItineraryDayRow & {
  activities: Array<ItineraryActivityRow>
}

export type ReservationRow = {
  id: string
  tripId: string
  type: ReservationType
  status: ReservationStatus
  providerName: string
  confirmationNumber: string | null
  startDateTime: Date | null
  endDateTime: Date | null
  location: string | null
  departureLocation: string | null
  arrivalLocation: string | null
  cost: number | null
  currency: TravelCurrency
  isPaid: boolean
  bookingUrl: string | null
  contactPhone: string | null
  contactEmail: string | null
  notes: string | null
}

export type PackingItemRow = {
  id: string
  packingListId: string
  name: string
  category: PackingCategory
  quantity: number
  isPacked: boolean
  notes: string | null
  sortOrder: number
}

export type PackingListRow = {
  id: string
  tripId: string
  name: string
}

export type PackingListWithItems = PackingListRow & {
  items: Array<PackingItemRow>
}

export type TravelBudgetItemRow = {
  id: string
  tripId: string
  category: TravelBudgetCategory
  description: string
  plannedAmount: number
  actualAmount: number | null
  currency: TravelCurrency
  notes: string | null
}

export type TravelContactRow = {
  id: string
  tripId: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  notes: string | null
  sortOrder: number
}

export type TripDetail = {
  trip: TripRow
  travelers: Array<TravelerRow>
  itineraryDays: Array<ItineraryDayWithActivities>
  reservations: Array<ReservationRow>
  packingLists: Array<PackingListWithItems>
  budgetItems: Array<TravelBudgetItemRow>
  contacts: Array<TravelContactRow>
}

// ─── Detail read (the trips.$id hub) ─────────────────────

export async function getTripDetail(
  householdId: string,
  tripId: string
): Promise<TripDetail | null> {
  const trips = await sql<Array<TripRow>>`
    SELECT "id", "name", "description", "destination", "startDate"::text,
           "endDate"::text, "status", "coverImageUrl", "notes", "createdAt"
    FROM "Trip"
    WHERE "id" = ${tripId} AND "householdId" = ${householdId}`
  const trip = trips[0] ?? null
  if (!trip) return null

  // Child tables have no householdId — ownership is established above; every
  // query below is keyed to the verified trip id.
  const [
    travelers,
    days,
    activities,
    reservations,
    packingLists,
    packingItems,
    budgetItems,
    contacts,
  ] = await Promise.all([
    sql<Array<TravelerRow>>`
      SELECT "id", "tripId", "householdMemberId", "displayName"
      FROM "Traveler"
      WHERE "tripId" = ${tripId}
      ORDER BY "createdAt" ASC`,
    sql<Array<ItineraryDayRow>>`
      SELECT "id", "tripId", "date"::text, "title", "notes", "sortOrder"
      FROM "ItineraryDay"
      WHERE "tripId" = ${tripId}
      ORDER BY "date" ASC`,
    sql<Array<ItineraryActivityRow>>`
      SELECT a."id", a."itineraryDayId", a."title", a."startTime", a."endTime",
             a."location", a."address", a."bookingRef", a."cost"::float8,
             a."currency", a."notes", a."sortOrder"
      FROM "ItineraryActivity" a
      JOIN "ItineraryDay" d ON d."id" = a."itineraryDayId"
      WHERE d."tripId" = ${tripId}
      ORDER BY a."sortOrder" ASC`,
    sql<Array<ReservationRow>>`
      SELECT "id", "tripId", "type", "status", "providerName",
             "confirmationNumber", "startDateTime", "endDateTime", "location",
             "departureLocation", "arrivalLocation", "cost"::float8,
             "currency", "isPaid", "bookingUrl", "contactPhone",
             "contactEmail", "notes"
      FROM "Reservation"
      WHERE "tripId" = ${tripId}
      ORDER BY "startDateTime" ASC NULLS FIRST`,
    sql<Array<PackingListRow>>`
      SELECT "id", "tripId", "name"
      FROM "PackingList"
      WHERE "tripId" = ${tripId}
      ORDER BY "createdAt" ASC`,
    sql<Array<PackingItemRow>>`
      SELECT i."id", i."packingListId", i."name", i."category", i."quantity",
             i."isPacked", i."notes", i."sortOrder"
      FROM "PackingItem" i
      JOIN "PackingList" l ON l."id" = i."packingListId"
      WHERE l."tripId" = ${tripId}
      ORDER BY i."sortOrder" ASC`,
    sql<Array<TravelBudgetItemRow>>`
      SELECT "id", "tripId", "category", "description",
             "plannedAmount"::float8, "actualAmount"::float8, "currency",
             "notes"
      FROM "TravelBudgetItem"
      WHERE "tripId" = ${tripId}
      ORDER BY "createdAt" ASC`,
    sql<Array<TravelContactRow>>`
      SELECT "id", "tripId", "name", "role", "phone", "email", "address",
             "website", "notes", "sortOrder"
      FROM "TravelContact"
      WHERE "tripId" = ${tripId}
      ORDER BY "sortOrder" ASC`,
  ])

  return {
    trip,
    travelers,
    itineraryDays: days.map((d) => ({
      ...d,
      activities: activities.filter((a) => a.itineraryDayId === d.id),
    })),
    reservations,
    packingLists: packingLists.map((l) => ({
      ...l,
      items: packingItems.filter((i) => i.packingListId === l.id),
    })),
    budgetItems,
    contacts,
  }
}

// ─── Travelers ───────────────────────────────────────────
// Traveler.householdMemberId stores a HouseholdMember.id (membershipId).
// UNIQUE(tripId, householdMemberId) — duplicate adds are rejected up front.

export async function addTraveler(
  tripId: string,
  householdMemberId: string,
  displayName: string
): Promise<{ ok: true } | { error: string }> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Traveler"
    WHERE "tripId" = ${tripId} AND "householdMemberId" = ${householdMemberId}`
  if (existing.length > 0) {
    return { error: "That person is already a traveler on this trip." }
  }
  await sql`
    INSERT INTO "Traveler" ("tripId", "householdMemberId", "displayName")
    VALUES (${tripId}, ${householdMemberId}, ${displayName})`
  return { ok: true }
}

export async function removeTraveler(
  householdId: string,
  travelerId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Traveler" tr
    USING "Trip" t
    WHERE tr."id" = ${travelerId} AND t."id" = tr."tripId"
      AND t."householdId" = ${householdId}
    RETURNING tr."id"`
  return rows.length > 0
}

// ─── Itinerary ───────────────────────────────────────────

export type ItineraryDayInput = {
  date: string
  title: string | null
  notes: string | null
}

// UNIQUE(tripId, date) — "day already exists" is a friendly error, not a 500.
export async function createItineraryDay(
  tripId: string,
  input: ItineraryDayInput
): Promise<{ ok: true } | { error: string }> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "ItineraryDay"
    WHERE "tripId" = ${tripId} AND "date" = ${input.date}`
  if (existing.length > 0) {
    return { error: "A day with this date already exists for this trip." }
  }
  const [{ count }] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "ItineraryDay"
    WHERE "tripId" = ${tripId}`
  await sql`
    INSERT INTO "ItineraryDay" ("tripId", "date", "title", "notes", "sortOrder")
    VALUES (${tripId}, ${input.date}, ${input.title}, ${input.notes}, ${count})`
  return { ok: true }
}

export async function deleteItineraryDay(
  householdId: string,
  dayId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ItineraryDay" d
    USING "Trip" t
    WHERE d."id" = ${dayId} AND t."id" = d."tripId"
      AND t."householdId" = ${householdId}
    RETURNING d."id"`
  return rows.length > 0
}

// Day ownership re-check up the chain (day → trip → household) before adding
// activities under it.
export async function dayBelongsToHousehold(
  householdId: string,
  dayId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT d."id"
    FROM "ItineraryDay" d
    JOIN "Trip" t ON t."id" = d."tripId"
    WHERE d."id" = ${dayId} AND t."householdId" = ${householdId}`
  return rows.length > 0
}

export type ItineraryActivityInput = {
  title: string
  startTime: string | null
  endTime: string | null
  location: string | null
  address: string | null
  bookingRef: string | null
  cost: number | null
  notes: string | null
}

export async function createItineraryActivity(
  dayId: string,
  input: ItineraryActivityInput
): Promise<void> {
  const [{ count }] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "ItineraryActivity"
    WHERE "itineraryDayId" = ${dayId}`
  await sql`
    INSERT INTO "ItineraryActivity" (
      "itineraryDayId", "title", "startTime", "endTime", "location",
      "address", "bookingRef", "cost", "notes", "sortOrder"
    ) VALUES (
      ${dayId}, ${input.title}, ${input.startTime}, ${input.endTime},
      ${input.location}, ${input.address}, ${input.bookingRef}, ${input.cost},
      ${input.notes}, ${count}
    )`
}

export async function deleteItineraryActivity(
  householdId: string,
  activityId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ItineraryActivity" a
    USING "ItineraryDay" d, "Trip" t
    WHERE a."id" = ${activityId} AND d."id" = a."itineraryDayId"
      AND t."id" = d."tripId" AND t."householdId" = ${householdId}
    RETURNING a."id"`
  return rows.length > 0
}

// ─── Reservations ────────────────────────────────────────

export type ReservationInput = {
  type: ReservationType
  providerName: string
  confirmationNumber: string | null
  startDateTime: string | null
  endDateTime: string | null
  location: string | null
  departureLocation: string | null
  arrivalLocation: string | null
  cost: number | null
  currency: TravelCurrency
  bookingUrl: string | null
  contactPhone: string | null
  contactEmail: string | null
  notes: string | null
}

export async function createReservation(
  tripId: string,
  input: ReservationInput
): Promise<void> {
  await sql`
    INSERT INTO "Reservation" (
      "tripId", "type", "providerName", "confirmationNumber", "startDateTime",
      "endDateTime", "location", "departureLocation", "arrivalLocation",
      "cost", "currency", "bookingUrl", "contactPhone", "contactEmail", "notes"
    ) VALUES (
      ${tripId}, ${input.type}::"ReservationType", ${input.providerName},
      ${input.confirmationNumber}, ${input.startDateTime}, ${input.endDateTime},
      ${input.location}, ${input.departureLocation}, ${input.arrivalLocation},
      ${input.cost}, ${input.currency}::"TravelCurrency", ${input.bookingUrl},
      ${input.contactPhone}, ${input.contactEmail}, ${input.notes}
    )`
}

export async function deleteReservation(
  householdId: string,
  reservationId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Reservation" r
    USING "Trip" t
    WHERE r."id" = ${reservationId} AND t."id" = r."tripId"
      AND t."householdId" = ${householdId}
    RETURNING r."id"`
  return rows.length > 0
}

// ─── Packing ─────────────────────────────────────────────

export async function createPackingList(
  tripId: string,
  name: string
): Promise<void> {
  await sql`
    INSERT INTO "PackingList" ("tripId", "name")
    VALUES (${tripId}, ${name})`
}

export async function deletePackingList(
  householdId: string,
  listId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "PackingList" l
    USING "Trip" t
    WHERE l."id" = ${listId} AND t."id" = l."tripId"
      AND t."householdId" = ${householdId}
    RETURNING l."id"`
  return rows.length > 0
}

// List ownership re-check up the chain (list → trip → household) before
// adding items under it.
export async function packingListBelongsToHousehold(
  householdId: string,
  listId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT l."id"
    FROM "PackingList" l
    JOIN "Trip" t ON t."id" = l."tripId"
    WHERE l."id" = ${listId} AND t."householdId" = ${householdId}`
  return rows.length > 0
}

export type PackingItemInput = {
  name: string
  category: PackingCategory
  quantity: number
  notes: string | null
}

export async function addPackingItem(
  listId: string,
  input: PackingItemInput
): Promise<void> {
  const [{ count }] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "PackingItem"
    WHERE "packingListId" = ${listId}`
  await sql`
    INSERT INTO "PackingItem" (
      "packingListId", "name", "category", "quantity", "notes", "sortOrder"
    ) VALUES (
      ${listId}, ${input.name}, ${input.category}::"PackingCategory",
      ${input.quantity}, ${input.notes}, ${count}
    )`
}

export async function togglePackingItem(
  householdId: string,
  itemId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "PackingItem" i
    SET "isPacked" = NOT i."isPacked", "updatedAt" = now()
    FROM "PackingList" l, "Trip" t
    WHERE i."id" = ${itemId} AND l."id" = i."packingListId"
      AND t."id" = l."tripId" AND t."householdId" = ${householdId}
    RETURNING i."id"`
  return rows.length > 0
}

export async function deletePackingItem(
  householdId: string,
  itemId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "PackingItem" i
    USING "PackingList" l, "Trip" t
    WHERE i."id" = ${itemId} AND l."id" = i."packingListId"
      AND t."id" = l."tripId" AND t."householdId" = ${householdId}
    RETURNING i."id"`
  return rows.length > 0
}

// ─── Budget ──────────────────────────────────────────────

export type TravelBudgetItemInput = {
  category: TravelBudgetCategory
  description: string
  plannedAmount: number
  actualAmount: number | null
  currency: TravelCurrency
  notes: string | null
}

export async function createBudgetItem(
  tripId: string,
  input: TravelBudgetItemInput
): Promise<void> {
  await sql`
    INSERT INTO "TravelBudgetItem" (
      "tripId", "category", "description", "plannedAmount", "actualAmount",
      "currency", "notes"
    ) VALUES (
      ${tripId}, ${input.category}::"TravelBudgetCategory",
      ${input.description}, ${input.plannedAmount}, ${input.actualAmount},
      ${input.currency}::"TravelCurrency", ${input.notes}
    )`
}

export async function deleteBudgetItem(
  householdId: string,
  itemId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "TravelBudgetItem" b
    USING "Trip" t
    WHERE b."id" = ${itemId} AND t."id" = b."tripId"
      AND t."householdId" = ${householdId}
    RETURNING b."id"`
  return rows.length > 0
}

// ─── Contacts ────────────────────────────────────────────

export type TravelContactInput = {
  name: string
  role: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  notes: string | null
}

export async function createTravelContact(
  tripId: string,
  input: TravelContactInput
): Promise<void> {
  const [{ count }] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "TravelContact"
    WHERE "tripId" = ${tripId}`
  await sql`
    INSERT INTO "TravelContact" (
      "tripId", "name", "role", "phone", "email", "address", "website",
      "notes", "sortOrder"
    ) VALUES (
      ${tripId}, ${input.name}, ${input.role}, ${input.phone}, ${input.email},
      ${input.address}, ${input.website}, ${input.notes}, ${count}
    )`
}

export async function deleteTravelContact(
  householdId: string,
  contactId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "TravelContact" c
    USING "Trip" t
    WHERE c."id" = ${contactId} AND t."id" = c."tripId"
      AND t."householdId" = ${householdId}
    RETURNING c."id"`
  return rows.length > 0
}
