import { createServerFn } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import {
  clearSessionCookie,
  currentSession,
  readSessionToken,
  requestMeta,
  writeSessionCookie,
} from "./auth"
import { authMiddleware } from "./middleware"
import { getUserWithSecretByEmail, verifyPassword } from "./users"
import { getMembership, listHouseholdsForUser } from "./households"
import { createSession, deleteSession, setActiveHousehold } from "./session"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const user = await getUserWithSecretByEmail(data.email)
    // Same generic message whether the email is unknown, inactive, or the
    // password is wrong — no account enumeration.
    if (!user || !user.active || !(await verifyPassword(user, data.password))) {
      return { error: "Invalid email or password." }
    }
    const households = await listHouseholdsForUser(user.id)
    const activeHouseholdId = households[0]?.id ?? null
    const { userAgent, ipAddress } = requestMeta()
    const token = await createSession(user.id, {
      userAgent,
      ipAddress,
      activeHouseholdId,
    })
    writeSessionCookie(token)
    return { ok: true as const }
  })

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const token = readSessionToken()
  if (token) await deleteSession(token)
  clearSessionCookie()
  return { ok: true as const }
})

// Drives the _authed layout loader: the user, their households, and the
// resolved active household for the switcher. Redirects to /login if no
// valid session.
export const getSessionContextFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await currentSession()
    if (!session) throw redirect({ to: "/login" })

    const households = await listHouseholdsForUser(session.user.id)
    const active =
      households.find((h) => h.id === session.activeHouseholdId) ??
      households[0] ??
      null

    // Heal a stale/empty active-household pointer.
    if (active && active.id !== session.activeHouseholdId) {
      const token = readSessionToken()
      if (token) await setActiveHousehold(token, active.id)
    }

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
        role: session.user.role,
      },
      households: households.map((h) => ({
        id: h.id,
        name: h.name,
        role: h.role,
      })),
      activeHousehold: active ? { id: active.id, name: active.name } : null,
    }
  }
)

export const switchHouseholdFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ householdId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // Verify membership before honoring the switch (never trust the input id).
    const membership = await getMembership(context.user.id, data.householdId)
    if (!membership) return { error: "You are not a member of that household." }
    await setActiveHousehold(context.sessionToken, data.householdId)
    return { ok: true as const }
  })
