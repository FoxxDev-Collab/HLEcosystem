import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { canManageHousehold } from "@/server/privileges"
import {
  createDebt,
  deleteDebt,
  getDebt,
  getRefinanceChain,
  linkDebtPaymentToTransaction,
  listDebtPayments,
  listDebts,
  listLinkableTransactionsForDebts,
  listLinkedAssets,
  listLinkedBills,
  recordDebtPayment,
  refinanceDebt,
  setDebtArchived,
  updateDebt,
} from "./debts"

const DEBT_TYPE = z.enum([
  "MORTGAGE",
  "AUTO_LOAN",
  "STUDENT_LOAN",
  "PERSONAL_LOAN",
  "HELOC",
  "CREDIT_CARD",
  "MEDICAL_DEBT",
  "OTHER",
])

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const money = z.number().min(0).max(99999999)

// Rates arrive as percentages (e.g. 6.5) and are stored as decimals (0.065),
// matching legacy createDebtAction.
const debtSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: DEBT_TYPE,
  lender: optText,
  originalPrincipal: money,
  currentBalance: money,
  interestRatePercent: z.number().min(0).max(99),
  termMonths: z.number().int().min(1).max(1200).nullable(),
  minimumPayment: money.nullable(),
  notes: optText,
})

function toDebtInput(data: z.infer<typeof debtSchema>) {
  const { interestRatePercent, ...rest } = data
  return { ...rest, interestRate: interestRatePercent / 100 }
}

export const getDebtsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const debts = await listDebts(context.householdId)
    return { debts }
  })

export const getDebtDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const debt = await getDebt(context.householdId, data.id)
    if (!debt) {
      return {
        debt: null,
        payments: [],
        linkedAssets: [],
        linkedBills: [],
        refinancedFrom: null,
        refinancedTo: null,
        linkableTransactions: [],
      }
    }
    const [payments, linkedAssets, linkedBills, chain, linkableTransactions] =
      await Promise.all([
        listDebtPayments(context.householdId, debt.id),
        listLinkedAssets(context.householdId, debt.id),
        listLinkedBills(context.householdId, debt.id),
        getRefinanceChain(context.householdId, debt),
        listLinkableTransactionsForDebts(context.householdId),
      ])
    return {
      debt,
      payments,
      linkedAssets,
      linkedBills,
      refinancedFrom: chain.refinancedFrom,
      refinancedTo: chain.refinancedTo,
      linkableTransactions,
    }
  })

export const createDebtFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => debtSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createDebt(context.householdId, toDebtInput(data))
    return { ok: true as const }
  })

export const updateDebtFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    debtSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    return updateDebt(context.householdId, id, toDebtInput(input))
  })

export const recordDebtPaymentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        debtId: z.string().min(1),
        totalAmount: z.number().positive().max(99999999),
        principalAmount: money,
        interestAmount: money,
        escrowAmount: money,
        extraPrincipal: money,
        linkedTransactionId: z.string().min(1).nullable(),
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    recordDebtPayment(context.householdId, data)
  )

export const linkDebtPaymentTransactionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        paymentId: z.string().min(1),
        transactionId: z.string().min(1).nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    linkDebtPaymentToTransaction(
      context.householdId,
      data.paymentId,
      data.transactionId
    )
  )

export const refinanceDebtFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        oldDebtId: z.string().min(1),
        name: z.string().trim().min(1).max(120),
        type: DEBT_TYPE,
        lender: optText,
        newBalance: money,
        interestRatePercent: z.number().min(0).max(99),
        termMonths: z.number().int().min(1).max(1200).nullable(),
        minimumPayment: money.nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { interestRatePercent, ...rest } = data
    return refinanceDebt(context.householdId, {
      ...rest,
      interestRate: interestRatePercent / 100,
    })
  })

export const toggleDebtArchivedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), isArchived: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) =>
    setDebtArchived(context.householdId, data.id, data.isArchived)
  )

export const deleteDebtFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    // Deletes the debt and its payment history irreversibly —
    // household-privileged (see privileges.ts).
    if (!canManageHousehold(context)) {
      return { error: "Only the household owner can delete a debt." }
    }
    return deleteDebt(context.householdId, data.id)
  })
