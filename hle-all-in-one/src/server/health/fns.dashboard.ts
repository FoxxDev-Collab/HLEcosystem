import { createServerFn } from "@tanstack/react-start"
import { householdMiddleware } from "@/server/middleware"
import {
  countActiveMedications,
  listDashboardMembers,
  listRecentVisits,
  listRefillsDue,
  listUpcomingAppointments,
  listUpcomingVaccinations,
} from "./dashboard"

export const getHealthDashboardFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [
      members,
      upcomingAppointments,
      activeMedicationCount,
      refillsDue,
      upcomingVaccinations,
      recentVisits,
    ] = await Promise.all([
      listDashboardMembers(context.householdId),
      listUpcomingAppointments(context.householdId),
      countActiveMedications(context.householdId),
      listRefillsDue(context.householdId),
      listUpcomingVaccinations(context.householdId),
      listRecentVisits(context.householdId),
    ])
    return {
      members,
      upcomingAppointments,
      activeMedicationCount,
      refillsDue,
      upcomingVaccinations,
      recentVisits,
    }
  })
