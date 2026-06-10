import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listAccountsForPicker } from "./accounts"
import { listCategoriesForPicker } from "./categories"
import {
  addTripExpense,
  createTrip,
  deleteTrip,
  deleteTripExpense,
  getTrip,
  listProjectOptions,
  listTripExpenses,
  listTrips,
  removeTripExpenseReceipt,
  updateTrip,
  updateTripStatus,
} from "./trips"

const TRIP_STATUS = z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"])
const TRIP_EXPENSE_TYPE = z.enum([
  "GAS",
  "FOOD",
  "LODGING",
  "TRANSPORT",
  "SUPPLIES",
  "OTHER",
])

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const tripSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optText,
  destination: optText,
  startDate: z.string().regex(DATE_RE),
  endDate: z.string().regex(DATE_RE),
  isTaxDeductible: z.boolean(),
  taxPurpose: optText,
  budgetPlannerProjectId: z.string().min(1).nullable(),
})

export const getTripsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [trips, projects] = await Promise.all([
      listTrips(context.householdId),
      listProjectOptions(context.householdId),
    ])
    return { trips, projects }
  })

export const getTripDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const trip = await getTrip(context.householdId, data.id)
    if (!trip) {
      return {
        trip: null,
        expenses: [],
        accounts: [],
        categories: [],
        projects: [],
      }
    }
    const [expenses, accounts, categories, projects] = await Promise.all([
      listTripExpenses(context.householdId, trip.id),
      listAccountsForPicker(context.householdId),
      listCategoriesForPicker(context.householdId),
      listProjectOptions(context.householdId),
    ])
    return { trip, expenses, accounts, categories, projects }
  })

export const createTripFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => tripSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id } = await createTrip(context.householdId, data)
    return { ok: true as const, id }
  })

export const updateTripFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    tripSchema.extend({ id: z.string().min(1), notes: optText }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    await updateTrip(context.householdId, id, input)
    return { ok: true as const }
  })

export const updateTripStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), status: TRIP_STATUS }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await updateTripStatus(context.householdId, data.id, data.status)
    return { ok: true as const }
  })

export const deleteTripFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteTrip(context.householdId, data.id)
  )

export const addTripExpenseFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        tripId: z.string().min(1),
        expenseType: TRIP_EXPENSE_TYPE,
        date: z.string().regex(DATE_RE),
        amount: z.number().positive().max(99999999),
        payee: optText,
        description: optText,
        accountId: z.string().min(1),
        categoryId: z.string().min(1).nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    addTripExpense(context.householdId, context.user.id, data)
  )

export const deleteTripExpenseFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), deleteTransaction: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) =>
    deleteTripExpense(context.householdId, data.id, data.deleteTransaction)
  )

export const removeTripExpenseReceiptFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ expenseId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) =>
    removeTripExpenseReceipt(context.householdId, data.expenseId)
  )
