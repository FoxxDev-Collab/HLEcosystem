import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  copyBudgetFromPreviousMonth,
  getBudgetsPage,
  setBudget,
} from "./budgets"

const yearMonth = {
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
}

export const getBudgetsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object(yearMonth).parse(d))
  .handler(async ({ data, context }) =>
    getBudgetsPage(context.householdId, data.year, data.month)
  )

export const setBudgetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        categoryId: z.string().min(1),
        ...yearMonth,
        amount: z.number().min(0).max(99999999),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    setBudget(
      context.householdId,
      data.categoryId,
      data.year,
      data.month,
      data.amount
    )
  )

export const copyBudgetFromPreviousMonthFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object(yearMonth).parse(d))
  .handler(async ({ data, context }) =>
    copyBudgetFromPreviousMonth(context.householdId, data.year, data.month)
  )
