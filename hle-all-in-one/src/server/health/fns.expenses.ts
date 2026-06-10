import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  healthMemberBelongsToHousehold,
  listActiveHealthMembers,
} from "./medications"
import {
  createMedicalExpense,
  deleteMedicalExpense,
  getHealthMemberName,
  listMedicalExpenses,
} from "./expenses"
import { listAccountsForPicker } from "@/server/finance/accounts"
import { listCategoriesForPicker } from "@/server/finance/categories"
import { createTransaction } from "@/server/finance/transactions"

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const idSchema = z.object({ id: z.string().min(1) })

const categorySchema = z.enum([
  "MEDICAL_EQUIPMENT",
  "VISION",
  "DENTAL",
  "SUPPLIES",
  "OVER_THE_COUNTER",
  "PRESCRIPTION",
  "COPAY",
  "LAB_WORK",
  "THERAPY",
  "OTHER",
])

export const getExpensesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, expenses, financeAccounts, financeCategories] =
      await Promise.all([
        listActiveHealthMembers(context.householdId),
        listMedicalExpenses(context.householdId),
        listAccountsForPicker(context.householdId),
        listCategoriesForPicker(context.householdId),
      ])
    return {
      members,
      expenses,
      financeAccounts,
      financeCategories: financeCategories.filter((c) => c.type === "EXPENSE"),
    }
  })

const expenseSchema = z.object({
  memberId: z.string().min(1),
  description: z.string().trim().min(1).max(300),
  category: categorySchema,
  amount: z.number().positive().max(99999999),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidFromHsa: z.boolean(),
  insuranceReimbursement: z.number().nonnegative().max(99999999).nullable(),
  notes: optText,
  // Optional "Sync to Family Finance" hand-off (legacy finance-bridge).
  finance: z
    .object({
      accountId: z.string().min(1),
      categoryId: z.string().min(1).nullable(),
    })
    .nullable(),
})

export const createMedicalExpenseFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => expenseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { memberId, finance, ...input } = data
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      memberId
    )
    if (!owned) return { error: "Family member not found." }
    await createMedicalExpense(memberId, input)

    // Optional finance mirror (legacy "Sync to Family Finance"). The expense
    // record above is the source of truth — a finance failure is reported as
    // a warning, not a rollback (matches legacy ordering). createTransaction
    // re-verifies account/category ownership (ADR-0005); the account balance
    // is owned by the sync_account_balance trigger.
    if (finance) {
      const memberName = await getHealthMemberName(
        context.householdId,
        memberId
      )
      const categoryLabel = input.category.replace(/_/g, " ")
      const result = await createTransaction(
        context.householdId,
        context.user.id,
        {
          type: "EXPENSE",
          accountId: finance.accountId,
          categoryId: finance.categoryId,
          amount: input.amount,
          date: input.expenseDate,
          payee: "Medical Expense",
          description: `${input.description} (${memberName ?? "Unknown"} - ${categoryLabel})`,
          transferToAccountId: null,
        }
      )
      if ("error" in result) {
        return {
          ok: true as const,
          financeWarning: `Expense saved, but the finance sync failed: ${result.error}`,
        }
      }
    }
    return { ok: true as const }
  })

export const deleteMedicalExpenseFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteMedicalExpense(context.householdId, data.id)
    if (!deleted) return { error: "Expense not found." }
    return { ok: true as const }
  })
