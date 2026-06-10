import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listAccountsForPicker } from "./accounts"
import { listCategoriesForPicker } from "./categories"
import {
  createRecurring,
  deleteRecurring,
  listRecurring,
  processDueRecurring,
  skipNextOccurrence,
  toggleRecurringActive,
} from "./recurring"

const optText = z
  .string()
  .max(200)
  .transform((v) => v.trim() || null)

export const getRecurringPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [recurrings, accounts, categories] = await Promise.all([
      listRecurring(context.householdId),
      listAccountsForPicker(context.householdId),
      listCategoriesForPicker(context.householdId),
    ])
    return { recurrings, accounts, categories }
  })

export const createRecurringFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
        accountId: z.string().min(1),
        categoryId: z.string().min(1).nullable(),
        transferToAccountId: z.string().min(1).nullable(),
        amount: z.coerce.number().positive(),
        payee: optText,
        frequency: z.enum([
          "DAILY",
          "WEEKLY",
          "BI_WEEKLY",
          "MONTHLY",
          "QUARTERLY",
          "YEARLY",
        ]),
        dayOfPeriod: z.number().int().min(1).max(31).nullable(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        autoCreate: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    createRecurring(context.householdId, data)
  )

export const toggleRecurringActiveFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await toggleRecurringActive(context.householdId, data.id)
    return { ok: true as const }
  })

export const skipNextOccurrenceFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    skipNextOccurrence(context.householdId, data.id)
  )

export const deleteRecurringFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteRecurring(context.householdId, data.id)
    return { ok: true as const }
  })

// The PG function creates due transactions, advances nextOccurrence, and
// deactivates expired rules atomically. Balance updates come from the
// per-INSERT trigger. Legacy had no cron — this is invoked from the button
// on the recurring page.
export const processDueRecurringFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const count = await processDueRecurring(
      context.householdId,
      context.user.id
    )
    return { ok: true as const, count }
  })
