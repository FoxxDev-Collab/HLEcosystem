import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listActiveHealthMembers } from "./medications"
import {
  createInsurancePolicy,
  deleteInsurancePolicy,
  filterHealthMemberIds,
  listInsurancePolicies,
  listPolicyCoverage,
  policyBelongsToHousehold,
  replacePolicyCoverage,
  togglePolicyActive,
} from "./insurance"

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const optDate = z
  .string()
  .max(10)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  })

const idSchema = z.object({ id: z.string().min(1) })

const insuranceTypeSchema = z.enum([
  "MEDICAL",
  "DENTAL",
  "VISION",
  "PRESCRIPTION",
  "SUPPLEMENTAL",
  "OTHER",
])

export const getInsurancePageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [members, policies, coverage] = await Promise.all([
      listActiveHealthMembers(context.householdId),
      listInsurancePolicies(context.householdId),
      listPolicyCoverage(context.householdId),
    ])
    return { members, policies, coverage }
  })

const policySchema = z.object({
  providerName: z.string().trim().min(1).max(200),
  policyNumber: z.string().trim().min(1).max(120),
  groupNumber: optText,
  policyHolderName: optText,
  insuranceType: insuranceTypeSchema,
  phoneNumber: optText,
  website: optText,
  effectiveDate: optDate,
  expirationDate: optDate,
  deductible: z.number().nonnegative().max(99999999).nullable(),
  outOfPocketMax: z.number().nonnegative().max(99999999).nullable(),
  copay: z.number().nonnegative().max(99999999).nullable(),
  coveredMemberIds: z.array(z.string().min(1)).max(100),
})

export const createInsurancePolicyFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => policySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { coveredMemberIds, ...input } = data
    // Dedupe before insert — UNIQUE(policyId, memberId) on the join table.
    const memberIds = await filterHealthMemberIds(context.householdId, [
      ...new Set(coveredMemberIds),
    ])
    try {
      await createInsurancePolicy(context.householdId, input, memberIds)
    } catch {
      return { error: "A member can only be covered once per policy." }
    }
    return { ok: true as const }
  })

export const updatePolicyCoverageFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        policyId: z.string().min(1),
        coveredMemberIds: z.array(z.string().min(1)).max(100),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await policyBelongsToHousehold(
      context.householdId,
      data.policyId
    )
    if (!owned) return { error: "Policy not found." }
    const memberIds = await filterHealthMemberIds(context.householdId, [
      ...new Set(data.coveredMemberIds),
    ])
    try {
      await replacePolicyCoverage(context.householdId, data.policyId, memberIds)
    } catch {
      return { error: "A member can only be covered once per policy." }
    }
    return { ok: true as const }
  })

export const togglePolicyActiveFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await togglePolicyActive(context.householdId, data.id)
    if (!toggled) return { error: "Policy not found." }
    return { ok: true as const }
  })

export const deletePolicyFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteInsurancePolicy(context.householdId, data.id)
    if (!deleted) return { error: "Policy not found." }
    return { ok: true as const }
  })
