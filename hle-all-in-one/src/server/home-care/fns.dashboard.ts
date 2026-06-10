import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  getActiveItemCount,
  getActiveRepairCount,
  getActiveVehicleCount,
  getCalendarEvents,
  getOverdueScheduleCount,
  listExpiringWarranties,
  listRecentMaintenanceLogs,
  listRecentRepairs,
  listSchedulesDueThisWeek,
} from "./dashboard"

export const getHomeCareDashboardFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [
      itemCount,
      vehicleCount,
      overdueCount,
      activeRepairCount,
      dueThisWeek,
      expiringWarranties,
      recentLogs,
      recentRepairs,
    ] = await Promise.all([
      getActiveItemCount(context.householdId),
      getActiveVehicleCount(context.householdId),
      getOverdueScheduleCount(context.householdId),
      getActiveRepairCount(context.householdId),
      listSchedulesDueThisWeek(context.householdId),
      listExpiringWarranties(context.householdId),
      listRecentMaintenanceLogs(context.householdId),
      listRecentRepairs(context.householdId),
    ])
    return {
      itemCount,
      vehicleCount,
      overdueCount,
      activeRepairCount,
      dueThisWeek,
      expiringWarranties,
      recentLogs,
      recentRepairs,
    }
  })

// month is 0-based, like Date#getMonth (legacy convention).
export const getHomeCareCalendarFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        year: z.number().int().min(1970).max(2200),
        month: z.number().int().min(0).max(11),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { year, month } = data
    const mm = String(month + 1).padStart(2, "0")
    const lastDay = new Date(year, month + 1, 0).getDate()
    const startDate = `${year}-${mm}-01`
    const endDate = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`
    return getCalendarEvents(context.householdId, startDate, endDate)
  })
