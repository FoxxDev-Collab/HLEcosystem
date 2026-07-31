// Household-privileged operations: household OWNER or instance ADMIN.
//
// The monolith has no household ADMIN role (HouseholdRole is OWNER | MEMBER),
// so household-level authority rests with the OWNER — plus the instance
// ADMIN, matching the owner-check convention in fns.households.ts. Applied
// to: media management (scan, enrich, parental controls — the legacy
// household-admin gate) and the irreversible finance deletes (account
// cascade, debt), where "any household member" was tenant-safe but wrong on
// intra-household authority — a MEMBER kid could wipe an account plus every
// attached transaction, import, and payment with no recovery short of a DB
// restore. Day-to-day mutations (transactions, bills, records) deliberately
// stay open to every member.
import type { HouseholdRole, Role } from "@/lib/types"

export function canManageHousehold(context: {
  user: { role: Role }
  membership: { role: HouseholdRole }
}): boolean {
  return context.user.role === "ADMIN" || context.membership.role === "OWNER"
}
