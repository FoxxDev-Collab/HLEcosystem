/**
 * REGRESSION TEST — credential-change session revocation (IA-5 / AC-12)
 *
 * v1 pre-release finding: changePasswordFn updated the hash and returned;
 * every other active session stayed valid for the rest of its 30 days. An
 * attacker holding a stolen session survived the victim rotating their
 * password. setUserPasswordFn (admin reset) had the same hole.
 *
 * Two layers of guard:
 *  1. SQL-shape tests for the revocation queries themselves.
 *  2. Source invariants (vitest runs in CI; the Playwright flow in
 *     e2e/password-revocation.spec.ts does not) — the fns MUST keep calling
 *     the revocation helpers. If these greps fail, the wiring was removed;
 *     do not weaken them without reading the e2e spec first.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteAllUserSessions, deleteOtherUserSessions } from "./session"

type SqlRows = Array<Record<string, unknown>>

const { sqlMock } = vi.hoisted(() => {
  const calls: Array<{ text: string; values: Array<unknown> }> = []
  const tag = (strings: TemplateStringsArray, ...values: Array<unknown>) => {
    calls.push({ text: strings.join(" "), values })
    return Promise.resolve([] as SqlRows)
  }
  const mock = Object.assign(tag, {
    calls,
    reset: () => {
      calls.length = 0
    },
  })
  return { sqlMock: mock }
})

vi.mock("@/server/db", () => ({ sql: sqlMock }))

describe("session revocation queries", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("deleteOtherUserSessions scopes by userId and excludes the kept token", async () => {
    await deleteOtherUserSessions("user-1", "keep-token")
    expect(sqlMock.calls).toHaveLength(1)
    const { text, values } = sqlMock.calls[0]
    expect(text).toMatch(/DELETE FROM "Session"/)
    expect(text).toMatch(/"userId" =/)
    expect(text).toMatch(/"token" <>/)
    expect(values).toEqual(["user-1", "keep-token"])
  })

  it("deleteAllUserSessions deletes every session for the user", async () => {
    await deleteAllUserSessions("user-1")
    expect(sqlMock.calls).toHaveLength(1)
    const { text, values } = sqlMock.calls[0]
    expect(text).toMatch(/DELETE FROM "Session"\s+WHERE "userId" =/)
    expect(values).toEqual(["user-1"])
  })
})

describe("revocation wiring stays in place (source invariants)", () => {
  const read = (file: string) =>
    readFile(path.resolve(import.meta.dirname, file), "utf8")

  it("changePasswordFn revokes other sessions after setUserPassword", async () => {
    const src = await read("fns.account.ts")
    const handler = src.slice(src.indexOf("changePasswordFn"))
    const setIdx = handler.indexOf("setUserPassword(")
    const revokeIdx = handler.indexOf("deleteOtherUserSessions(")
    expect(setIdx).toBeGreaterThan(-1)
    expect(revokeIdx).toBeGreaterThan(setIdx)
  })

  it("setUserPasswordFn (admin reset) revokes the target's sessions", async () => {
    const src = await read("fns.users.ts")
    const handler = src.slice(src.indexOf("setUserPasswordFn"))
    expect(handler).toMatch(/deleteAllUserSessions\(/)
    // Self-reset keeps the acting session alive — no self-logout mid-action.
    expect(handler).toMatch(/deleteOtherUserSessions\(/)
  })
})
