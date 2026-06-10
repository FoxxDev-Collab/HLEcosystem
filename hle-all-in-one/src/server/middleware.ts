import { createMiddleware } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import { readSessionToken } from "./auth"
import { validateSession } from "./session"
import { getMembership } from "./households"

// Authentication gate. Every protected server function builds on this.
export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const token = readSessionToken()
    const result = token ? await validateSession(token) : null
    if (!result || !token) {
      throw redirect({ to: "/login" })
    }
    return next({
      context: {
        user: result.user,
        sessionToken: token,
        activeHouseholdId: result.activeHouseholdId,
      },
    })
  }
)

// Instance-admin gate (account provisioning, user CRUD).
export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (context.user.role !== "ADMIN") {
      throw redirect({ to: "/manager/dashboard" })
    }
    return next()
  })

// Household gate. The ADR-0005 boundary, generalized for multi-household:
// re-verify on EVERY request that the user is actually a member of the active
// household before any household-scoped work proceeds. Never trust the cookie
// alone.
export const householdMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const { activeHouseholdId, user } = context
    if (!activeHouseholdId) {
      throw redirect({ to: "/manager/households" })
    }
    const membership = await getMembership(user.id, activeHouseholdId)
    if (!membership) {
      throw redirect({ to: "/manager/households" })
    }
    return next({ context: { householdId: activeHouseholdId, membership } })
  })
