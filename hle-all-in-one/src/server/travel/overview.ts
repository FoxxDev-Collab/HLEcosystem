import { sql } from "@/server/db"

// Read-only aggregates for the travel dashboard + the standalone rollup pages
// (itinerary, reservations, packing, budget, contacts). All tables here are
// owned by the trips feature — this module only READs them, scoped through
// "Trip"."householdId". The single write is the trip-status auto-sync below.

export type TripStatus =
  "PLANNING" | "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

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

// ─── Trip status auto-sync ──────────────────────────────────────────────────
// Legacy ran syncTripStatusesAction from a client effect on the dashboard;
// here it runs inside the dashboard loader server fn, scoped to the active
// household only. The two conditions are disjoint (endDate >= today vs
// endDate < today) so order does not matter.
export async function syncTripStatuses(householdId: string): Promise<void> {
  await sql`
    UPDATE "Trip"
    SET "status" = 'IN_PROGRESS', "updatedAt" = now()
    WHERE "householdId" = ${householdId}
      AND "status" IN ('PLANNING', 'BOOKED')
      AND "startDate" <= CURRENT_DATE
      AND "endDate" >= CURRENT_DATE`
  await sql`
    UPDATE "Trip"
    SET "status" = 'COMPLETED', "updatedAt" = now()
    WHERE "householdId" = ${householdId}
      AND "status" IN ('PLANNING', 'BOOKED', 'IN_PROGRESS')
      AND "endDate" < CURRENT_DATE`
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export type ActiveTripRow = {
  id: string
  name: string
  destination: string | null
  startDate: string
  endDate: string
  totalItems: number
  packedItems: number
  plannedTotal: number
  actualTotal: number
}

export async function getActiveTrip(
  householdId: string
): Promise<ActiveTripRow | null> {
  const rows = await sql<Array<ActiveTripRow>>`
    SELECT t."id", t."name", t."destination",
           t."startDate"::text, t."endDate"::text,
           (SELECT count(*) FROM "PackingItem" pi
              JOIN "PackingList" pl ON pl."id" = pi."packingListId"
              WHERE pl."tripId" = t."id")::int AS "totalItems",
           (SELECT count(*) FROM "PackingItem" pi
              JOIN "PackingList" pl ON pl."id" = pi."packingListId"
              WHERE pl."tripId" = t."id" AND pi."isPacked")::int AS "packedItems",
           COALESCE((SELECT sum(b."plannedAmount") FROM "TravelBudgetItem" b
              WHERE b."tripId" = t."id"), 0)::float8 AS "plannedTotal",
           COALESCE((SELECT sum(b."actualAmount") FROM "TravelBudgetItem" b
              WHERE b."tripId" = t."id"), 0)::float8 AS "actualTotal"
    FROM "Trip" t
    WHERE t."householdId" = ${householdId}
      AND t."status" = 'IN_PROGRESS'
      AND t."startDate" <= CURRENT_DATE
      AND t."endDate" >= CURRENT_DATE
    ORDER BY t."startDate" ASC
    LIMIT 1`
  return rows[0] ?? null
}

export type TodayActivityRow = {
  id: string
  title: string
  startTime: string | null
  location: string | null
  bookingRef: string | null
}

export type TodayItinerary = {
  title: string | null
  activities: Array<TodayActivityRow>
}

export async function getTodayItinerary(
  householdId: string,
  tripId: string
): Promise<TodayItinerary | null> {
  const days = await sql<Array<{ id: string; title: string | null }>>`
    SELECT d."id", d."title"
    FROM "ItineraryDay" d
    JOIN "Trip" t ON t."id" = d."tripId"
    WHERE d."tripId" = ${tripId}
      AND t."householdId" = ${householdId}
      AND d."date" = CURRENT_DATE
    LIMIT 1`
  const day = days[0]
  if (!day) return null
  const activities = await sql<Array<TodayActivityRow>>`
    SELECT "id", "title", "startTime", "location", "bookingRef"
    FROM "ItineraryActivity"
    WHERE "itineraryDayId" = ${day.id}
    ORDER BY "sortOrder" ASC, "createdAt" ASC`
  return { title: day.title, activities }
}

export type UpcomingTripRow = {
  id: string
  name: string
  destination: string | null
  startDate: string
  status: TripStatus
  totalItems: number
  packedItems: number
  reservationCount: number
}

export async function listUpcomingTrips(
  householdId: string
): Promise<Array<UpcomingTripRow>> {
  return sql<Array<UpcomingTripRow>>`
    SELECT t."id", t."name", t."destination", t."startDate"::text, t."status",
           (SELECT count(*) FROM "PackingItem" pi
              JOIN "PackingList" pl ON pl."id" = pi."packingListId"
              WHERE pl."tripId" = t."id")::int AS "totalItems",
           (SELECT count(*) FROM "PackingItem" pi
              JOIN "PackingList" pl ON pl."id" = pi."packingListId"
              WHERE pl."tripId" = t."id" AND pi."isPacked")::int AS "packedItems",
           (SELECT count(*) FROM "Reservation" r
              WHERE r."tripId" = t."id")::int AS "reservationCount"
    FROM "Trip" t
    WHERE t."householdId" = ${householdId}
      AND t."status" IN ('PLANNING', 'BOOKED')
      AND t."startDate" > CURRENT_DATE
    ORDER BY t."startDate" ASC
    LIMIT 5`
}

export type ExpiringDocumentRow = {
  id: string
  type: string
  displayName: string | null
  expiryDate: string
}

export async function listExpiringDocuments(
  householdId: string
): Promise<Array<ExpiringDocumentRow>> {
  return sql<Array<ExpiringDocumentRow>>`
    SELECT "id", "type", "displayName", "expiryDate"::text
    FROM "TravelDocument"
    WHERE "householdId" = ${householdId}
      AND "expiryDate" >= CURRENT_DATE
      AND "expiryDate" <= CURRENT_DATE + INTERVAL '90 days'
    ORDER BY "expiryDate" ASC
    LIMIT 5`
}

export async function countTrips(householdId: string): Promise<number> {
  const rows = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "Trip"
    WHERE "householdId" = ${householdId}`
  return rows[0]?.count ?? 0
}

export async function countDocuments(householdId: string): Promise<number> {
  const rows = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "TravelDocument"
    WHERE "householdId" = ${householdId}`
  return rows[0]?.count ?? 0
}

// ─── Itinerary rollup ───────────────────────────────────────────────────────

export type RollupActivityRow = {
  id: string
  itineraryDayId: string
  title: string
  startTime: string | null
  endTime: string | null
  location: string | null
  bookingRef: string | null
  cost: number | null
  currency: TravelCurrency
  notes: string | null
}

export type RollupDayRow = {
  id: string
  tripId: string
  date: string
  title: string | null
  notes: string | null
}

export type ItineraryTrip = {
  id: string
  name: string
  days: Array<RollupDayRow & { activities: Array<RollupActivityRow> }>
}

export async function getItineraryRollup(
  householdId: string
): Promise<Array<ItineraryTrip>> {
  const trips = await sql<Array<{ id: string; name: string }>>`
    SELECT t."id", t."name"
    FROM "Trip" t
    WHERE t."householdId" = ${householdId}
      AND EXISTS (SELECT 1 FROM "ItineraryDay" d WHERE d."tripId" = t."id")
    ORDER BY t."startDate" ASC`
  const days = await sql<Array<RollupDayRow>>`
    SELECT d."id", d."tripId", d."date"::text, d."title", d."notes"
    FROM "ItineraryDay" d
    JOIN "Trip" t ON t."id" = d."tripId"
    WHERE t."householdId" = ${householdId}
    ORDER BY d."date" ASC`
  const activities = await sql<Array<RollupActivityRow>>`
    SELECT a."id", a."itineraryDayId", a."title", a."startTime", a."endTime",
           a."location", a."bookingRef", a."cost"::float8, a."currency", a."notes"
    FROM "ItineraryActivity" a
    JOIN "ItineraryDay" d ON d."id" = a."itineraryDayId"
    JOIN "Trip" t ON t."id" = d."tripId"
    WHERE t."householdId" = ${householdId}
    ORDER BY a."sortOrder" ASC, a."createdAt" ASC`

  const actsByDay = new Map<string, Array<RollupActivityRow>>()
  for (const a of activities) {
    const list = actsByDay.get(a.itineraryDayId) ?? []
    list.push(a)
    actsByDay.set(a.itineraryDayId, list)
  }
  const daysByTrip = new Map<
    string,
    Array<RollupDayRow & { activities: Array<RollupActivityRow> }>
  >()
  for (const d of days) {
    const list = daysByTrip.get(d.tripId) ?? []
    list.push({ ...d, activities: actsByDay.get(d.id) ?? [] })
    daysByTrip.set(d.tripId, list)
  }
  return trips.map((t) => ({ ...t, days: daysByTrip.get(t.id) ?? [] }))
}

// ─── Reservations rollup ────────────────────────────────────────────────────

export type RollupReservationRow = {
  id: string
  tripId: string
  type: ReservationType
  status: ReservationStatus
  providerName: string
  confirmationNumber: string | null
  startDateTime: Date | null
  location: string | null
  departureLocation: string | null
  arrivalLocation: string | null
  cost: number | null
  currency: TravelCurrency
  isPaid: boolean
  bookingUrl: string | null
}

export type ReservationsTrip = {
  id: string
  name: string
  reservations: Array<RollupReservationRow>
}

export async function getReservationsRollup(
  householdId: string
): Promise<Array<ReservationsTrip>> {
  const trips = await sql<Array<{ id: string; name: string }>>`
    SELECT t."id", t."name"
    FROM "Trip" t
    WHERE t."householdId" = ${householdId}
      AND EXISTS (SELECT 1 FROM "Reservation" r WHERE r."tripId" = t."id")
    ORDER BY t."startDate" ASC`
  const reservations = await sql<Array<RollupReservationRow>>`
    SELECT r."id", r."tripId", r."type", r."status", r."providerName",
           r."confirmationNumber", r."startDateTime", r."location",
           r."departureLocation", r."arrivalLocation", r."cost"::float8,
           r."currency", r."isPaid", r."bookingUrl"
    FROM "Reservation" r
    JOIN "Trip" t ON t."id" = r."tripId"
    WHERE t."householdId" = ${householdId}
    ORDER BY r."startDateTime" ASC`

  const byTrip = new Map<string, Array<RollupReservationRow>>()
  for (const r of reservations) {
    const list = byTrip.get(r.tripId) ?? []
    list.push(r)
    byTrip.set(r.tripId, list)
  }
  return trips.map((t) => ({ ...t, reservations: byTrip.get(t.id) ?? [] }))
}

// ─── Packing rollup ─────────────────────────────────────────────────────────

export type RollupPackingItemRow = {
  id: string
  packingListId: string
  name: string
  category: PackingCategory
  quantity: number
  isPacked: boolean
}

export type PackingTrip = {
  id: string
  name: string
  lists: Array<{
    id: string
    name: string
    items: Array<RollupPackingItemRow>
  }>
}

export async function getPackingRollup(
  householdId: string
): Promise<Array<PackingTrip>> {
  const trips = await sql<Array<{ id: string; name: string }>>`
    SELECT t."id", t."name"
    FROM "Trip" t
    WHERE t."householdId" = ${householdId}
      AND EXISTS (SELECT 1 FROM "PackingList" pl WHERE pl."tripId" = t."id")
    ORDER BY t."startDate" ASC`
  const lists = await sql<Array<{ id: string; tripId: string; name: string }>>`
    SELECT pl."id", pl."tripId", pl."name"
    FROM "PackingList" pl
    JOIN "Trip" t ON t."id" = pl."tripId"
    WHERE t."householdId" = ${householdId}
    ORDER BY pl."createdAt" ASC`
  const items = await sql<Array<RollupPackingItemRow>>`
    SELECT pi."id", pi."packingListId", pi."name", pi."category",
           pi."quantity", pi."isPacked"
    FROM "PackingItem" pi
    JOIN "PackingList" pl ON pl."id" = pi."packingListId"
    JOIN "Trip" t ON t."id" = pl."tripId"
    WHERE t."householdId" = ${householdId}
    ORDER BY pi."sortOrder" ASC, pi."createdAt" ASC`

  const itemsByList = new Map<string, Array<RollupPackingItemRow>>()
  for (const i of items) {
    const list = itemsByList.get(i.packingListId) ?? []
    list.push(i)
    itemsByList.set(i.packingListId, list)
  }
  const listsByTrip = new Map<string, PackingTrip["lists"]>()
  for (const l of lists) {
    const list = listsByTrip.get(l.tripId) ?? []
    list.push({ id: l.id, name: l.name, items: itemsByList.get(l.id) ?? [] })
    listsByTrip.set(l.tripId, list)
  }
  return trips.map((t) => ({ ...t, lists: listsByTrip.get(t.id) ?? [] }))
}

// ─── Budget rollup ──────────────────────────────────────────────────────────
// Per-trip and grand totals are aggregated in SQL (SUM), not in JS.

export type BudgetTripTotalsRow = {
  id: string
  name: string
  planned: number
  actual: number
}

export type RollupBudgetItemRow = {
  id: string
  tripId: string
  category: TravelBudgetCategory
  description: string
  plannedAmount: number
  actualAmount: number | null
  currency: TravelCurrency
}

export type BudgetRollup = {
  grand: { planned: number; actual: number }
  trips: Array<BudgetTripTotalsRow & { items: Array<RollupBudgetItemRow> }>
}

export async function getBudgetRollup(
  householdId: string
): Promise<BudgetRollup> {
  const grandRows = await sql<Array<{ planned: number; actual: number }>>`
    SELECT COALESCE(sum(b."plannedAmount"), 0)::float8 AS "planned",
           COALESCE(sum(b."actualAmount") FILTER (WHERE b."actualAmount" IS NOT NULL), 0)::float8 AS "actual"
    FROM "TravelBudgetItem" b
    JOIN "Trip" t ON t."id" = b."tripId"
    WHERE t."householdId" = ${householdId}`
  const tripTotals = await sql<Array<BudgetTripTotalsRow>>`
    SELECT t."id", t."name",
           COALESCE(sum(b."plannedAmount"), 0)::float8 AS "planned",
           COALESCE(sum(b."actualAmount") FILTER (WHERE b."actualAmount" IS NOT NULL), 0)::float8 AS "actual"
    FROM "Trip" t
    JOIN "TravelBudgetItem" b ON b."tripId" = t."id"
    WHERE t."householdId" = ${householdId}
    GROUP BY t."id"
    ORDER BY t."startDate" ASC`
  const items = await sql<Array<RollupBudgetItemRow>>`
    SELECT b."id", b."tripId", b."category", b."description",
           b."plannedAmount"::float8, b."actualAmount"::float8, b."currency"
    FROM "TravelBudgetItem" b
    JOIN "Trip" t ON t."id" = b."tripId"
    WHERE t."householdId" = ${householdId}
    ORDER BY b."category" ASC, b."createdAt" ASC`

  const itemsByTrip = new Map<string, Array<RollupBudgetItemRow>>()
  for (const i of items) {
    const list = itemsByTrip.get(i.tripId) ?? []
    list.push(i)
    itemsByTrip.set(i.tripId, list)
  }
  return {
    grand: grandRows[0] ?? { planned: 0, actual: 0 },
    trips: tripTotals.map((t) => ({
      ...t,
      items: itemsByTrip.get(t.id) ?? [],
    })),
  }
}

// ─── Contacts rollup ────────────────────────────────────────────────────────

export type RollupContactRow = {
  id: string
  tripId: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  notes: string | null
}

export type ContactsTrip = {
  id: string
  name: string
  contacts: Array<RollupContactRow>
}

export async function getContactsRollup(
  householdId: string
): Promise<Array<ContactsTrip>> {
  const trips = await sql<Array<{ id: string; name: string }>>`
    SELECT t."id", t."name"
    FROM "Trip" t
    WHERE t."householdId" = ${householdId}
      AND EXISTS (SELECT 1 FROM "TravelContact" c WHERE c."tripId" = t."id")
    ORDER BY t."startDate" ASC`
  const contacts = await sql<Array<RollupContactRow>>`
    SELECT c."id", c."tripId", c."name", c."role", c."phone", c."email",
           c."address", c."website", c."notes"
    FROM "TravelContact" c
    JOIN "Trip" t ON t."id" = c."tripId"
    WHERE t."householdId" = ${householdId}
    ORDER BY c."sortOrder" ASC, c."createdAt" ASC`

  const byTrip = new Map<string, Array<RollupContactRow>>()
  for (const c of contacts) {
    const list = byTrip.get(c.tripId) ?? []
    list.push(c)
    byTrip.set(c.tripId, list)
  }
  return trips.map((t) => ({ ...t, contacts: byTrip.get(t.id) ?? [] }))
}
