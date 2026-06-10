// Insurance port from hle-family_health /insurance. "InsurancePolicy" is
// household-scoped directly; per-member coverage lives in the
// "InsurancePolicyCoverage" join table (UNIQUE(policyId, memberId)) and is
// scoped through the policy.
import { sql } from "@/server/db"
import { healthMemberBelongsToHousehold } from "./medications"

export type InsuranceType =
  | "MEDICAL"
  | "DENTAL"
  | "VISION"
  | "PRESCRIPTION"
  | "SUPPLEMENTAL"
  | "OTHER"

export type InsurancePolicyRow = {
  id: string
  providerName: string
  policyNumber: string
  groupNumber: string | null
  policyHolderName: string | null
  insuranceType: InsuranceType
  phoneNumber: string | null
  website: string | null
  effectiveDate: string | null
  expirationDate: string | null
  deductible: number | null
  outOfPocketMax: number | null
  copay: number | null
  isActive: boolean
}

export type PolicyCoverageRow = {
  id: string
  policyId: string
  memberId: string
  memberFirstName: string
  memberLastName: string
}

export type InsurancePolicyInput = {
  providerName: string
  policyNumber: string
  groupNumber: string | null
  policyHolderName: string | null
  insuranceType: InsuranceType
  phoneNumber: string | null
  website: string | null
  effectiveDate: string | null
  expirationDate: string | null
  deductible: number | null
  outOfPocketMax: number | null
  copay: number | null
}

export async function listInsurancePolicies(
  householdId: string
): Promise<Array<InsurancePolicyRow>> {
  return sql<Array<InsurancePolicyRow>>`
    SELECT "id", "providerName", "policyNumber", "groupNumber",
           "policyHolderName", "insuranceType", "phoneNumber", "website",
           "effectiveDate"::text, "expirationDate"::text,
           "deductible"::float8, "outOfPocketMax"::float8, "copay"::float8,
           "isActive"
    FROM "InsurancePolicy"
    WHERE "householdId" = ${householdId}
    ORDER BY "isActive" DESC, "insuranceType" ASC, "providerName" ASC`
}

export async function listPolicyCoverage(
  householdId: string
): Promise<Array<PolicyCoverageRow>> {
  return sql<Array<PolicyCoverageRow>>`
    SELECT c."id", c."policyId", c."memberId",
           hm."firstName" AS "memberFirstName",
           hm."lastName" AS "memberLastName"
    FROM "InsurancePolicyCoverage" c
    JOIN "InsurancePolicy" p ON p."id" = c."policyId"
    JOIN "HealthMember" hm ON hm."id" = c."memberId"
    WHERE p."householdId" = ${householdId}
    ORDER BY hm."firstName" ASC, hm."lastName" ASC`
}

// Ownership re-check before mutating coverage by a client-supplied policyId
// (ADR-0005).
export async function policyBelongsToHousehold(
  householdId: string,
  policyId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "InsurancePolicy"
    WHERE "id" = ${policyId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// Drops any client-supplied member id that does not belong to the household
// (legacy create rule: silently filter, don't fail the whole submit).
export async function filterHealthMemberIds(
  householdId: string,
  memberIds: Array<string>
): Promise<Array<string>> {
  const valid: Array<string> = []
  for (const id of memberIds) {
    if (await healthMemberBelongsToHousehold(householdId, id)) valid.push(id)
  }
  return valid
}

export async function createInsurancePolicy(
  householdId: string,
  input: InsurancePolicyInput,
  coveredMemberIds: Array<string>
): Promise<string> {
  // Caller must pre-filter coveredMemberIds via filterHealthMemberIds.
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "InsurancePolicy" (
      "householdId", "providerName", "policyNumber", "groupNumber",
      "policyHolderName", "insuranceType", "phoneNumber", "website",
      "effectiveDate", "expirationDate", "deductible", "outOfPocketMax",
      "copay"
    ) VALUES (
      ${householdId}, ${input.providerName}, ${input.policyNumber},
      ${input.groupNumber}, ${input.policyHolderName},
      ${input.insuranceType}::"InsuranceType", ${input.phoneNumber},
      ${input.website}, ${input.effectiveDate}, ${input.expirationDate},
      ${input.deductible}, ${input.outOfPocketMax}, ${input.copay}
    ) RETURNING "id"`
  const policyId = rows[0].id
  for (const memberId of coveredMemberIds) {
    await addPolicyCoverage(policyId, memberId)
  }
  return policyId
}

// UNIQUE(policyId, memberId) backstops double-covering a member; callers
// dedupe first and surface a violation as { error }.
export async function addPolicyCoverage(
  policyId: string,
  memberId: string
): Promise<void> {
  await sql`
    INSERT INTO "InsurancePolicyCoverage" ("policyId", "memberId")
    VALUES (${policyId}, ${memberId})`
}

// Legacy rule: coverage updates replace the full set of covered members.
export async function replacePolicyCoverage(
  householdId: string,
  policyId: string,
  coveredMemberIds: Array<string>
): Promise<void> {
  // Caller must verify policy ownership and pre-filter member ids.
  await sql`
    DELETE FROM "InsurancePolicyCoverage" c
    USING "InsurancePolicy" p
    WHERE c."policyId" = ${policyId} AND p."id" = c."policyId"
      AND p."householdId" = ${householdId}`
  for (const memberId of coveredMemberIds) {
    await addPolicyCoverage(policyId, memberId)
  }
}

export async function togglePolicyActive(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "InsurancePolicy"
    SET "isActive" = NOT "isActive", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteInsurancePolicy(
  householdId: string,
  id: string
): Promise<boolean> {
  // Coverage rows cascade (ON DELETE CASCADE on policyId).
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "InsurancePolicy"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}
