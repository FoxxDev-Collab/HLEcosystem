import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { AI_NOT_CONFIGURED_ERROR, isAiConfigured } from "./claude-api"
import {
  acceptBillLink,
  acceptDebtLink,
  acceptRecurringLink,
  analyzeTransactions,
  autoLinkTransactions,
  countLinkPatterns,
  createBillFromSuggestion,
  createRecurringFromSuggestion,
  listUnlinkedTransactions,
} from "./smart-link"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX_AMOUNT = 100000000

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

const FREQUENCY = z.enum([
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
])

const payeePattern = z
  .string()
  .max(300)
  .nullable()
  .transform((v) => (v ? v.trim() || null : null))

export const getSmartLinkPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [transactions, patternCount] = await Promise.all([
      listUnlinkedTransactions(context.householdId),
      countLinkPatterns(context.householdId),
    ])
    return { transactions, patternCount, aiConfigured: isAiConfigured() }
  })

export const analyzeTransactionsFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionIds: z.array(z.string().regex(UUID_RE)).max(100),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    if (!isAiConfigured()) {
      return { error: AI_NOT_CONFIGURED_ERROR }
    }
    return analyzeTransactions(context.householdId, data.transactionIds)
  })

export const acceptDebtLinkFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().regex(UUID_RE),
        debtId: z.string().regex(UUID_RE),
        totalAmount: z.number().min(0).max(MAX_AMOUNT),
        principalAmount: z.number().min(0).max(MAX_AMOUNT),
        interestAmount: z.number().min(0).max(MAX_AMOUNT),
        payeePattern,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    acceptDebtLink(context.householdId, data)
  )

export const acceptBillLinkFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().regex(UUID_RE),
        billId: z.string().regex(UUID_RE),
        amountPaid: z.number().min(0).max(MAX_AMOUNT),
        payeePattern,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    acceptBillLink(context.householdId, data)
  )

export const acceptRecurringLinkFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().regex(UUID_RE),
        recurringId: z.string().regex(UUID_RE),
        payeePattern,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    acceptRecurringLink(context.householdId, data)
  )

export const createBillFromSuggestionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        payee: z.string().trim().min(1).max(300),
        category: BILL_CATEGORY,
        expectedAmount: z.number().positive().max(MAX_AMOUNT),
        dueDayOfMonth: z.number().int().min(1).max(31),
        transactionIds: z.array(z.string().regex(UUID_RE)).max(100),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    createBillFromSuggestion(context.householdId, data)
  )

export const createRecurringFromSuggestionFn = createServerFn({
  method: "POST",
})
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        payee: z.string().trim().min(1).max(300),
        amount: z.number().positive().max(MAX_AMOUNT),
        frequency: FREQUENCY,
        accountId: z.string().regex(UUID_RE),
        transactionIds: z.array(z.string().regex(UUID_RE)).max(100),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    createRecurringFromSuggestion(context.householdId, data)
  )

export const autoLinkTransactionsFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => autoLinkTransactions(context.householdId))
