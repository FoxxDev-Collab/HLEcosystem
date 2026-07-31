import { createServerFn } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { getMembership, listMembers } from "@/server/households"
import { canManageHousehold } from "@/server/privileges"
import {
  MOVIE_RATINGS,
  TV_RATINGS,
  deleteParentalProfile,
  listParentalProfiles,
  upsertParentalProfile,
} from "./parental"

// Page data for OWNER-or-instance-ADMIN (see privileges.ts): household members
// joined with their parental profile (or none — none means unrestricted).
export const getParentalPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    if (!canManageHousehold(context)) {
      throw redirect({ to: "/media" })
    }
    const [members, profiles] = await Promise.all([
      listMembers(context.householdId),
      listParentalProfiles(context.householdId),
    ])
    const byUserId = new Map(profiles.map((p) => [p.userId, p]))
    return {
      members: members.map((m) => ({
        userId: m.userId,
        name: m.name,
        displayName: m.displayName,
        email: m.email,
        role: m.role,
        profile: byUserId.get(m.userId) ?? null,
      })),
    }
  })

const setSchema = z.object({
  userId: z.string().uuid(),
  maxMovieRating: z.enum(MOVIE_RATINGS).nullable(),
  maxTvRating: z.enum(TV_RATINGS).nullable(),
  blockUnrated: z.boolean(),
})

export const setParentalProfileFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => setSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!canManageHousehold(context)) {
      return { error: "Only the household owner can set parental controls." }
    }
    // Re-verify the target user is a member of THIS household before writing
    // — never trust an id from the form (ADR-0005).
    const membership = await getMembership(data.userId, context.householdId)
    if (!membership) {
      return { error: "That user is not a member of this household." }
    }
    await upsertParentalProfile(
      context.householdId,
      data.userId,
      data.maxMovieRating,
      data.maxTvRating,
      data.blockUnrated
    )
    return { ok: true as const }
  })

export const clearParentalProfileFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    if (!canManageHousehold(context)) {
      return { error: "Only the household owner can clear parental controls." }
    }
    await deleteParentalProfile(context.householdId, data.userId)
    return { ok: true as const }
  })
