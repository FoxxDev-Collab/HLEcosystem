/**
 * REGRESSION TEST — first-run setup wizard (ADR-0006)
 *
 * /setup is the app's only deliberately unauthenticated mutation surface.
 * These pin its two safety properties:
 *
 *  1. The admin INSERT is atomically guarded — `WHERE NOT EXISTS (User)`
 *     behind an advisory lock, so the wizard is dead the moment any user
 *     exists and concurrent submissions cannot both win.
 *  2. The setup token comparison is constant-time and env-overridable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createFirstAdmin } from "./setup"
import {
  _resetSetupTokenForTests,
  getSetupToken,
  setupTokenMatches,
} from "./setup-token"

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

const INPUT = {
  email: "owner@example.test",
  firstName: "Own",
  lastName: "Er",
  passwordHash: "hashed",
  householdName: "The Example Family",
}

describe("createFirstAdmin — atomic empty-instance guard", () => {
  beforeEach(() => sqlMock.reset())

  it("takes the advisory lock and guards the INSERT with NOT EXISTS", async () => {
    sqlMock.queueResults(
      [], // advisory lock
      [{ id: "user-1" }],
      [{ id: "hh-1" }],
      [] // membership insert
    )
    const created = await createFirstAdmin(INPUT)
    expect(created).toEqual({ userId: "user-1", householdId: "hh-1" })

    expect(sqlMock.calls[0]).toMatch(/pg_advisory_xact_lock/)
    const userInsert = sqlMock.calls.find((c) => /INSERT INTO "User"/.test(c))
    expect(userInsert).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM "User"\)/)
    const membership = sqlMock.calls.find((c) =>
      /INSERT INTO "HouseholdMember"/.test(c)
    )
    expect(membership).toBeDefined()
  })

  it("returns null (creates nothing else) when a user already exists", async () => {
    sqlMock.queueResults(
      [], // advisory lock
      [] // guarded INSERT matched no rows
    )
    const created = await createFirstAdmin(INPUT)
    expect(created).toBeNull()
    expect(
      sqlMock.calls.filter((c) => /INSERT INTO "Household"/.test(c))
    ).toHaveLength(0)
  })
})

describe("setup token", () => {
  beforeEach(() => _resetSetupTokenForTests())
  afterEach(() => {
    vi.unstubAllEnvs()
    _resetSetupTokenForTests()
  })

  it("generates a stable random token and matches only exactly", () => {
    const token = getSetupToken()
    expect(token).toMatch(/^[0-9a-f]{16}$/)
    expect(getSetupToken()).toBe(token)
    expect(setupTokenMatches(token)).toBe(true)
    expect(setupTokenMatches(token.slice(0, -1))).toBe(false)
    expect(setupTokenMatches(`${token}x`)).toBe(false)
    expect(setupTokenMatches("")).toBe(false)
  })

  it("SETUP_TOKEN env overrides generation", () => {
    vi.stubEnv("SETUP_TOKEN", "provisioned-secret")
    expect(getSetupToken()).toBe("provisioned-secret")
    expect(setupTokenMatches("provisioned-secret")).toBe(true)
    expect(setupTokenMatches("wrong")).toBe(false)
  })
})
