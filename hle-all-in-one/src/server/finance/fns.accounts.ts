import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { canManageHousehold } from "@/server/privileges"
import { audit } from "@/server/audit"
import {
  adjustBalance,
  createAccount,
  deleteAccountCascade,
  getAccount,
  listAccounts,
  listAccountsForPicker,
  setAccountArchived,
  updateAccount,
} from "./accounts"
import { listAccountTransactions } from "./transactions"

const ACCOUNT_TYPE = z.enum([
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
  "CASH",
  "INVESTMENT",
  "LOAN",
  "HSA",
  "OTHER",
])

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const accountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: ACCOUNT_TYPE,
  institution: optText,
  creditLimit: z.number().nonnegative().max(99999999).nullable(),
  interestRate: z.number().min(0).max(99).nullable(),
  hsaAnnualLimit: z.number().nonnegative().max(99999999).nullable(),
  hsaFamilyCoverage: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  notes: optText,
})

export const getAccountsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const accounts = await listAccounts(context.householdId)
    return { accounts }
  })

export const getAccountDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const account = await getAccount(context.householdId, data.id)
    if (!account) return { account: null, transactions: [] }
    const transactions = await listAccountTransactions(
      context.householdId,
      account.id,
      25
    )
    return { account, transactions }
  })

// Picker fn for other modules' forms (bills, debts, import, trips, bridges).
export const listAccountsForPickerFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listAccountsForPicker(context.householdId))

export const createAccountFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    accountSchema
      .extend({ initialBalance: z.number().min(-99999999).max(99999999) })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await createAccount(context.householdId, data)
    return { ok: true as const }
  })

export const updateAccountFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    accountSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    await updateAccount(context.householdId, id, input)
    return { ok: true as const }
  })

export const toggleAccountArchivedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), isArchived: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await setAccountArchived(context.householdId, data.id, data.isArchived)
    return { ok: true as const }
  })

export const adjustBalanceFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().min(1),
        targetBalance: z.number().min(-99999999).max(99999999),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    adjustBalance(
      context.householdId,
      context.user.id,
      data.accountId,
      data.targetBalance
    )
  )

export const deleteAccountFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    // Cascade-deletes every attached transaction, import, and payment with
    // no recovery path — household-privileged (see privileges.ts).
    if (!canManageHousehold(context)) {
      return { error: "Only the household owner can delete an account." }
    }
    const result = await deleteAccountCascade(context.householdId, data.id)
    if (!("error" in result)) {
      await audit("finance.account.delete", {
        actorUserId: context.user.id,
        actorEmail: context.user.email,
        householdId: context.householdId,
        targetType: "Account",
        targetId: data.id,
      })
    }
    return result
  })
