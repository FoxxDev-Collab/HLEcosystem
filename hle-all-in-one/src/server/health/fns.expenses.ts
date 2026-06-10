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
  listMedicalExpenses,
} from "./expenses"

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
    const [members, expenses] = await Promise.all([
      listActiveHealthMembers(context.householdId),
      listMedicalExpenses(context.householdId),
    ])
    return { members, expenses }
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
})

export const createMedicalExpenseFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => expenseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { memberId, ...input } = data
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      memberId
    )
    if (!owned) return { error: "Family member not found." }
    await createMedicalExpense(memberId, input)
    // TODO(finance): legacy optionally mirrored this expense into
    // family_finance (see src/server/health/expenses.ts header).
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
