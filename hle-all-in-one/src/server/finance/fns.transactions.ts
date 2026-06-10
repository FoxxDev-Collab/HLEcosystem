import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listAccountsForPicker } from "./accounts"
import { listCategoriesForPicker } from "./categories"
import {
  TRANSACTIONS_PAGE_SIZE,
  createTransaction,
  createTransactionSchema,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  updateTransactionSchema,
} from "./transactions"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const filtersSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).nullable(),
  accountId: z.string().regex(UUID_RE).nullable(),
  categoryId: z.string().regex(UUID_RE).nullable(),
  q: z.string().max(200).nullable(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  minAmount: z.number().nonnegative().nullable(),
  maxAmount: z.number().nonnegative().nullable(),
  page: z.number().int().min(1).max(100000),
})

export const getTransactionsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => filtersSchema.parse(d))
  .handler(async ({ data, context }) => {
    const [{ transactions, totalCount }, accounts, categories] =
      await Promise.all([
        listTransactions(context.householdId, data),
        listAccountsForPicker(context.householdId),
        listCategoriesForPicker(context.householdId),
      ])
    return {
      transactions,
      totalCount,
      pageSize: TRANSACTIONS_PAGE_SIZE,
      accounts,
      categories,
    }
  })

export const createTransactionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => createTransactionSchema.parse(d))
  .handler(async ({ data, context }) =>
    createTransaction(context.householdId, context.user.id, data)
  )

export const updateTransactionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => updateTransactionSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateTransaction(context.householdId, data)
  )

export const deleteTransactionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteTransaction(context.householdId, data.id)
  )
