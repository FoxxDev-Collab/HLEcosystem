import { createServerFn } from "@tanstack/react-start"
import { householdMiddleware } from "@/server/middleware"
import {
  countDocuments,
  countTrips,
  getActiveTrip,
  getBudgetRollup,
  getContactsRollup,
  getItineraryRollup,
  getPackingRollup,
  getReservationsRollup,
  getTodayItinerary,
  listExpiringDocuments,
  listUpcomingTrips,
  syncTripStatuses,
} from "./overview"

export const getTravelDashboardFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    // Legacy ran the status sync from a client effect; here the loader keeps
    // trip statuses fresh before reading, scoped to the active household.
    await syncTripStatuses(context.householdId)

    const [
      activeTrip,
      upcomingTrips,
      expiringDocuments,
      totalTrips,
      totalDocuments,
    ] = await Promise.all([
      getActiveTrip(context.householdId),
      listUpcomingTrips(context.householdId),
      listExpiringDocuments(context.householdId),
      countTrips(context.householdId),
      countDocuments(context.householdId),
    ])
    const todayItinerary = activeTrip
      ? await getTodayItinerary(context.householdId, activeTrip.id)
      : null

    return {
      activeTrip,
      todayItinerary,
      upcomingTrips,
      expiringDocuments,
      totalTrips,
      totalDocuments,
    }
  })

export const getItineraryRollupFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => getItineraryRollup(context.householdId))

export const getReservationsRollupFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => getReservationsRollup(context.householdId))

export const getPackingRollupFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => getPackingRollup(context.householdId))

export const getBudgetRollupFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => getBudgetRollup(context.householdId))

export const getContactsRollupFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => getContactsRollup(context.householdId))
