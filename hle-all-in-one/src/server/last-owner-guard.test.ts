/**
 * REGRESSION TEST — last-OWNER lockout guards (core-audit 2026-07-31)
 *
 * A household whose only OWNER disappears is permanently unmanageable:
 * addMemberFn / removeMemberFn both hard-require an OWNER membership, and no
 * instance-admin override exists at the household layer. Two paths could
 * strand a household that way:
 *   - removeMember: an OWNER removing their own membership (fns.households
 *     permits self-removal) or the last OWNER generally
 *   - deleteUser: HouseholdMember."userId" is ON DELETE CASCADE, so deleting
 *     the user silently removes the membership row
 *
 * Both now refuse. These tests drive the data-layer functions with the house
 * tagged-template recorder mock and assert the guard changes BEHAVIOR (no
 * destructive statement issued on the refusal path), not just query text.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { removeMember } from "./households"
import { deleteUser } from "./users"

type SqlRows = Array<Record<string, unknown>>

const { sqlMock } = vi.hoisted(() => {
  const calls: Array<string> = []
  let queue: Array<SqlRows> = []
  const tag = (strings: TemplateStringsArray, ..._values: Array<unknown>) => {
    calls.push(strings.join(" "))
    return Promise.resolve(queue.shift() ?? [])
  }
  const mock = Object.assign(tag, {
    begin: async (cb: (tx: typeof tag) => Promise<unknown>) => cb(tag),
    queueResults: (...results: Array<SqlRows>) => {
      queue = [...results]
    },
    calls,
    reset: () => {
      calls.length = 0
      queue = []
    },
  })
  return { sqlMock: mock }
})

vi.mock("@/server/db", () => ({ sql: sqlMock }))

const HH = "hh-1"

beforeEach(() => sqlMock.reset())

describe("removeMember last-owner guard", () => {
  it("the DELETE itself carries the other-OWNER-exists condition (atomic)", async () => {
    sqlMock.queueResults([{ id: "m-1" }])
    const result = await removeMember(HH, "m-1")
    expect(result).toEqual({ ok: true })
    const del = sqlMock.calls.find((q) => q.includes("DELETE"))
    expect(del, "guard must live inside the DELETE, not a prior read").toMatch(
      /EXISTS/
    )
    expect(del).toMatch(/'OWNER'/)
  })

  it("refuses when the guarded DELETE matches nothing but the member exists", async () => {
    // 1st queue: DELETE returns no rows (guard blocked it)
    // 2nd queue: the follow-up lookup finds the member — so it was an OWNER
    sqlMock.queueResults([], [{ role: "OWNER" }])
    const result = await removeMember(HH, "m-owner")
    expect(result).toEqual({
      error:
        "Cannot remove the household's only owner. Add another owner first.",
    })
  })

  it("reports a plain miss as not-found, not as an owner refusal", async () => {
    sqlMock.queueResults([], [])
    expect(await removeMember(HH, "m-gone")).toEqual({
      error: "Member not found.",
    })
  })
})

describe("deleteUser last-owner guard", () => {
  it("refuses — and issues NO DELETE — when the user solely owns a household with members", async () => {
    sqlMock.queueResults([{ name: "Price Family" }])
    const result = await deleteUser("u-owner")
    expect(result).toEqual({
      error:
        'This user is the only owner of "Price Family", which still has members. Add another owner there first.',
    })
    expect(
      sqlMock.calls.filter((q) => q.includes("DELETE")),
      "the refusal path must never reach the DELETE"
    ).toHaveLength(0)
  })

  it("deletes when no household would be orphaned", async () => {
    sqlMock.queueResults([]) // orphan probe: no rows
    const result = await deleteUser("u-free")
    expect(result).toEqual({ ok: true })
    expect(sqlMock.calls.some((q) => q.includes('DELETE FROM "User"'))).toBe(
      true
    )
  })
})
