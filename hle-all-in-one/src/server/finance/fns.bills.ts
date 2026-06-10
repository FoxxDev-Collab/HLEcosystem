import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listAccountsForPicker } from "./accounts"
import { listCategoriesForPicker } from "./categories"
import { listDebtsForPicker } from "./debts"
import {
  createBill,
  deleteBill,
  listBills,
  listLinkableTransactionsForBills,
  markBillPaid,
  setBillActive,
  updateBill,
} from "./bills"

const BILL_CATEGORY = z.enum([
  "UTILITIES",
  "INSURANCE",
  "SUBSCRIPTIONS",
  "PHONE",
  "INTERNET",
  "RENT",
  "MORTGAGE",
  "CAR_PAYMENT",
  "CHILD_CARE",
  "STREAMING",
  "OTHER",
])

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const billSchema = z.object({
  name: z.string().trim().min(1).max(120),
  payee: optText,
  category: BILL_CATEGORY,
  expectedAmount: z.number().min(0).max(99999999),
  isVariableAmount: z.boolean(),
  dueDayOfMonth: z.number().int().min(1).max(31),
  autoPay: z.boolean(),
  autoPayAccountId: z.string().min(1).nullable(),
  linkedDebtId: z.string().min(1).nullable(),
  defaultCategoryId: z.string().min(1).nullable(),
  websiteUrl: z
    .union([z.url().max(500), z.literal("")])
    .transform((v) => v || null),
  notes: optText,
})

export const getBillsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    const [bills, accounts, categories, debts, linkableTransactions] =
      await Promise.all([
        listBills(context.householdId, monthStart),
        listAccountsForPicker(context.householdId),
        listCategoriesForPicker(context.householdId),
        listDebtsForPicker(context.householdId),
        listLinkableTransactionsForBills(context.householdId),
      ])
    return { bills, accounts, categories, debts, linkableTransactions }
  })

export const createBillFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => billSchema.parse(d))
  .handler(async ({ data, context }) => createBill(context.householdId, data))

export const updateBillFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    billSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    return updateBill(context.householdId, id, input)
  })

export const markBillPaidFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        billId: z.string().min(1),
        amountPaid: z.number().min(0).max(99999999),
        linkedTransactionId: z.string().min(1).nullable(),
        confirmationNumber: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => markBillPaid(context.householdId, data))

export const toggleBillActiveFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), isActive: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) =>
    setBillActive(context.householdId, data.id, data.isActive)
  )

export const deleteBillFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) =>
    deleteBill(context.householdId, data.id)
  )
