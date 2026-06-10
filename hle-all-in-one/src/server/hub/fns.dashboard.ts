import { createServerFn } from "@tanstack/react-start"
import { householdMiddleware } from "@/server/middleware"
import { listAllDateEvents } from "./dates"
import {
  findSpouseMember,
  getActiveGiftIdeaCount,
  getActiveMemberCount,
  getGiftsGivenCount,
  getHouseholdName,
  getPendingMediaRequestCount,
  getTodoListCount,
  listRecentGifts,
} from "./dashboard"

export const getDashboardFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [
      events,
      memberCount,
      activeIdeas,
      giftsGiven,
      recentGifts,
      todoListCount,
      mediaRequestCount,
      householdName,
      spouse,
    ] = await Promise.all([
      listAllDateEvents(context.householdId),
      getActiveMemberCount(context.householdId),
      getActiveGiftIdeaCount(context.householdId),
      getGiftsGivenCount(context.householdId),
      listRecentGifts(context.householdId),
      getTodoListCount(context.householdId),
      getPendingMediaRequestCount(),
      getHouseholdName(context.householdId),
      findSpouseMember(context.householdId, context.user.id),
    ])

    // events is already sorted soonest-first (days ascending).
    const upcoming30Count = events.filter(
      (e) => e.days >= 0 && e.days <= 30
    ).length
    const upcoming = events.filter((e) => e.days >= 0).slice(0, 10)

    // Marriage hero card data — same lookup as legacy: the anniversary whose
    // label mentions "wedding".
    const wedding = spouse
      ? (events.find(
          (e) =>
            e.type === "ANNIVERSARY" &&
            e.label.toLowerCase().includes("wedding")
        ) ?? null)
      : null
    const yearsMarried = wedding
      ? new Date().getFullYear() - Number(wedding.date.slice(0, 4))
      : null

    return {
      userFirstName: context.user.name.split(" ")[0] ?? "there",
      householdName,
      spouse: spouse ? { firstName: spouse.firstName } : null,
      wedding: wedding ? { date: wedding.date, years: yearsMarried } : null,
      memberCount,
      totalEvents: events.length,
      upcoming30Count,
      upcoming,
      activeIdeas,
      giftsGiven,
      recentGifts,
      todoListCount,
      mediaRequestCount,
    }
  })
