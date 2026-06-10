import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listMembers } from "@/server/households"
import {
  addChoreAssignment,
  addDays,
  choreBelongsToHousehold,
  completeChore,
  createChore,
  createReward,
  deleteChore,
  deleteReward,
  generateWeekChores,
  listActiveChores,
  listAssignmentsForHousehold,
  listChores,
  listCompletionsBetween,
  listEarnedPoints,
  listRedemptions,
  listRewards,
  listRoomOptions,
  listSpentPoints,
  redeemReward,
  removeChoreAssignment,
  skipChore,
  toggleChoreActive,
} from "./chores"

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")

const idSchema = z.object({ id: z.string().min(1) })

const frequencySchema = z.enum([
  "DAILY",
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "CUSTOM_DAYS",
])

const rotationSchema = z.enum(["NONE", "ROUND_ROBIN", "WEEKLY_ROTATION"])

// Monday of the week containing the given date (or today). Legacy rule:
// Sunday belongs to the previous week's Monday.
function getWeekStart(week: string | null): string {
  let d: Date
  if (week) {
    const [y, m, day] = week.split("-").map(Number)
    d = new Date(y, m - 1, day)
  } else {
    d = new Date()
  }
  const dayOfWeek = d.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + mondayOffset
  )
  const mm = String(monday.getMonth() + 1).padStart(2, "0")
  const dd = String(monday.getDate()).padStart(2, "0")
  return `${monday.getFullYear()}-${mm}-${dd}`
}

export type PointSummary = {
  memberId: string | null
  memberName: string
  earned: number
  spent: number
  balance: number
}

async function getPointTotals(householdId: string) {
  const [earned, spent] = await Promise.all([
    listEarnedPoints(householdId),
    listSpentPoints(householdId),
  ])
  const earnedById = new Map(
    earned.map((e) => [e.completedById ?? "", e.earned])
  )
  const spentById = new Map(spent.map((s) => [s.redeemedById ?? "", s.spent]))
  return { earnedById, spentById }
}

// ─── Chore chart page ───────────────────────────────────────

export const getChoreChartFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ week: dateStr.nullable() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const weekStart = getWeekStart(data.week)
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const weekEnd = weekDates[6]

    const [chores, completions, totals] = await Promise.all([
      listActiveChores(context.householdId),
      listCompletionsBetween(context.householdId, weekStart, weekEnd),
      getPointTotals(context.householdId),
    ])

    // Leaderboard: every assignee appearing in this week's completions, with
    // lifetime earned points and current balance (legacy semantics).
    const seen = new Map<string, PointSummary>()
    for (const c of completions) {
      const key = c.completedById ?? ""
      if (seen.has(key)) continue
      const earned = totals.earnedById.get(key) ?? 0
      const spent = totals.spentById.get(key) ?? 0
      seen.set(key, {
        memberId: c.completedById,
        memberName: c.completedByName,
        earned,
        spent,
        balance: earned - spent,
      })
    }

    return {
      weekStart,
      weekDates,
      chores,
      completions,
      pointSummaries: [...seen.values()],
    }
  })

export const generateWeekChoresFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ weekStart: dateStr }).parse(d))
  .handler(async ({ data, context }) => {
    await generateWeekChores(context.householdId, getWeekStart(data.weekStart))
    return { ok: true as const }
  })

export const completeChoreFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ completionId: z.string().min(1), notes: optText }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const ok = await completeChore(
      context.householdId,
      data.completionId,
      data.notes
    )
    if (!ok) return { error: "Chore occurrence not found." }
    return { ok: true as const }
  })

export const skipChoreFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ completionId: z.string().min(1), notes: optText }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const ok = await skipChore(
      context.householdId,
      data.completionId,
      data.notes
    )
    if (!ok) return { error: "Chore occurrence not found." }
    return { ok: true as const }
  })

// ─── Manage chores page ─────────────────────────────────────

export const getManageChoresFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [chores, assignments, rooms, members] = await Promise.all([
      listChores(context.householdId),
      listAssignmentsForHousehold(context.householdId),
      listRoomOptions(context.householdId),
      listMembers(context.householdId),
    ])
    return {
      chores,
      assignments,
      rooms,
      members: members.map((m) => ({
        membershipId: m.membershipId,
        displayName: m.displayName,
      })),
    }
  })

const choreSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optText,
  roomId: z.string().transform((v) => v || null),
  frequency: frequencySchema,
  customIntervalDays: z.number().int().min(1).nullable(),
  rotationMode: rotationSchema,
  pointValue: z.number().int().min(0),
  estimatedMinutes: z.number().int().min(1).nullable(),
})

export const createChoreFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    choreSchema
      .extend({ assigneeIds: z.array(z.string().min(1)).max(50) })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { assigneeIds, ...input } = data
    // Assignees are HouseholdMember ids; resolve display names server-side —
    // never trust names from the client.
    const members = await listMembers(context.householdId)
    const byId = new Map(members.map((m) => [m.membershipId, m.displayName]))
    const assignees: Array<{ assigneeId: string; assigneeName: string }> = []
    for (const id of assigneeIds) {
      const name = byId.get(id)
      if (!name) return { error: "Assignee is not a member of this household." }
      assignees.push({ assigneeId: id, assigneeName: name })
    }
    await createChore(context.householdId, input, assignees)
    return { ok: true as const }
  })

export const deleteChoreFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteChore(context.householdId, data.id)
    if (!deleted) return { error: "Chore not found." }
    return { ok: true as const }
  })

export const toggleChoreActiveFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await toggleChoreActive(context.householdId, data.id)
    if (!toggled) return { error: "Chore not found." }
    return { ok: true as const }
  })

export const addChoreAssignmentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({ choreId: z.string().min(1), assigneeId: z.string().min(1) })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const owned = await choreBelongsToHousehold(
      context.householdId,
      data.choreId
    )
    if (!owned) return { error: "Chore not found." }
    const membership = (await listMembers(context.householdId)).find(
      (m) => m.membershipId === data.assigneeId
    )
    if (!membership) {
      return { error: "Assignee is not a member of this household." }
    }
    await addChoreAssignment(
      context.householdId,
      data.choreId,
      data.assigneeId,
      membership.displayName
    )
    return { ok: true as const }
  })

export const removeChoreAssignmentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const removed = await removeChoreAssignment(context.householdId, data.id)
    if (!removed) return { error: "Assignment not found." }
    return { ok: true as const }
  })

// ─── Rewards page ───────────────────────────────────────────

export const getRewardsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [rewards, redemptions, members, totals] = await Promise.all([
      listRewards(context.householdId),
      listRedemptions(context.householdId),
      listMembers(context.householdId),
      getPointTotals(context.householdId),
    ])
    const memberBalances = members.map((m) => {
      const earned = totals.earnedById.get(m.membershipId) ?? 0
      const spent = totals.spentById.get(m.membershipId) ?? 0
      return {
        memberId: m.membershipId,
        memberName: m.displayName,
        earned,
        spent,
        balance: earned - spent,
      }
    })
    return { rewards, redemptions, memberBalances }
  })

export const createRewardFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        description: optText,
        pointCost: z.number().int().min(1),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await createReward(
      context.householdId,
      data.title,
      data.description,
      data.pointCost
    )
    return { ok: true as const }
  })

export const deleteRewardFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteReward(context.householdId, data.id)
    if (!deleted) return { error: "Reward not found." }
    return { ok: true as const }
  })

export const redeemRewardFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        rewardId: z.string().min(1),
        redeemedById: z.string().min(1),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const membership = (await listMembers(context.householdId)).find(
      (m) => m.membershipId === data.redeemedById
    )
    if (!membership) {
      return { error: "That person is not a member of this household." }
    }
    const error = await redeemReward(
      context.householdId,
      data.rewardId,
      data.redeemedById,
      membership.displayName
    )
    if (error) return { error }
    return { ok: true as const }
  })
