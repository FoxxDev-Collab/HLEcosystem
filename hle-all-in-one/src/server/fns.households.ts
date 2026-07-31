import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { authMiddleware, householdMiddleware } from "./middleware"
import { setActiveHousehold } from "./session"
import {
  addExistingUserByEmail,
  createHousehold,
  listHouseholdsForUser,
  listMembers,
  removeMember,
} from "./households"

// Households page data — gated by auth only (NOT householdMiddleware), so a
// user with no household yet can still load the page to create their first.
export const getHouseholdsPageFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const households = await listHouseholdsForUser(context.user.id)
    const active =
      households.find((h) => h.id === context.activeHouseholdId) ?? null
    return {
      households,
      active: active
        ? { id: active.id, name: active.name, role: active.role }
        : null,
      members: active ? await listMembers(active.id) : [],
    }
  })

export const createHouseholdFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1).max(120) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const hh = await createHousehold(
      data.name,
      context.user.id,
      context.user.name
    )
    // New household becomes the active one immediately.
    await setActiveHousehold(context.sessionToken, hh.id)
    return { ok: true as const, household: hh }
  })

export const listMembersFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    return {
      members: await listMembers(context.householdId),
      myRole: context.membership.role,
    }
  })

export const addMemberFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        role: z.enum(["OWNER", "MEMBER"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    if (context.membership.role !== "OWNER") {
      return { error: "Only the household owner can add members." }
    }
    return addExistingUserByEmail(context.householdId, data.email, data.role)
  })

export const removeMemberFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ membershipId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    if (context.membership.role !== "OWNER") {
      return { error: "Only the household owner can remove members." }
    }
    return removeMember(context.householdId, data.membershipId)
  })
