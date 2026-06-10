import { createServerFn } from "@tanstack/react-start"
import { householdMiddleware } from "@/server/middleware"
import {
  getMonthlyFlows,
  getNetWorthTotals,
  getTopSpendingCategories,
  listDashboardAccounts,
  listRecentTransactions,
  listUpcomingBills,
} from "./dashboard"

export const getFinanceDashboardFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [
      accounts,
      flows,
      recentTransactions,
      upcomingBills,
      netWorthTotals,
      spendingByCategory,
    ] = await Promise.all([
      listDashboardAccounts(context.householdId),
      getMonthlyFlows(context.householdId),
      listRecentTransactions(context.householdId),
      listUpcomingBills(context.householdId),
      getNetWorthTotals(context.householdId),
      getTopSpendingCategories(context.householdId),
    ])
    return {
      accounts,
      flows,
      recentTransactions,
      upcomingBills,
      netWorthTotals,
      spendingByCategory,
    }
  })
