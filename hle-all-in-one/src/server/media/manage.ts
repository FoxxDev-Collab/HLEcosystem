// Who may manage a household's media (scan, enrich, parental controls).
//
// Legacy hle-media gated these on HouseholdMember.role = 'ADMIN'. The monolith
// has no household ADMIN role (HouseholdRole is OWNER | MEMBER), so the
// equivalent is the household OWNER — plus the instance ADMIN, matching the
// owner-check convention in fns.households.ts. The previous adminMiddleware
// gate (instance ADMIN only) was wrong in both directions: a household OWNER
// couldn't scan their own library, and nobody but the instance operator could
// set parental controls.
import type { HouseholdRole, Role } from "@/lib/types"

export function canManageMedia(context: {
  user: { role: Role }
  membership: { role: HouseholdRole }
}): boolean {
  return context.user.role === "ADMIN" || context.membership.role === "OWNER"
}
