/**
 * REGRESSION TEST — audit trail (AU-2/AU-3)
 *
 * v1 pre-release finding: zero logging existed anywhere in the app — failed
 * logins, session revocations, user deletions, and the admin backup
 * endpoints (which stream every password hash) all executed without a trace,
 * contradicting the workspace "audit logging on all write operations"
 * standard.
 *
 * Guards: (1) the writer's insert shape and its never-throws contract — an
 * audit failure must not break the audited operation; (2) source invariants
 * pinning every wired event, since vitest runs in CI and the browser suite
 * does not. Removing a wiring line below should fail this suite.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { audit } from "./audit"

const { sqlMock } = vi.hoisted(() => {
  const calls: Array<{ text: string; values: Array<unknown> }> = []
  let failNext = false
  const tag = (strings: TemplateStringsArray, ...values: Array<unknown>) => {
    calls.push({ text: strings.join(" "), values })
    if (failNext) {
      failNext = false
      return Promise.reject(new Error("db down"))
    }
    return Promise.resolve([])
  }
  const mock = Object.assign(tag, {
    calls,
    failOnce: () => {
      failNext = true
    },
    reset: () => {
      calls.length = 0
      failNext = false
    },
  })
  return { sqlMock: mock }
})

vi.mock("@/server/db", () => ({ sql: sqlMock }))

describe("audit writer", () => {
  beforeEach(() => sqlMock.reset())

  it("inserts a parameterized AuditLog row", async () => {
    await audit("auth.login.failure", {
      actorEmail: "a@b.test",
      ipAddress: "203.0.113.9",
      detail: { reason: "bad-password" },
    })
    expect(sqlMock.calls).toHaveLength(1)
    const { text, values } = sqlMock.calls[0]
    expect(text).toMatch(/INSERT INTO "AuditLog"/)
    expect(values[0]).toBe("auth.login.failure")
    expect(values).toContain("a@b.test")
    expect(values).toContain("203.0.113.9")
    // detail is serialized JSON, still a bound parameter (never interpolated).
    expect(values).toContain(JSON.stringify({ reason: "bad-password" }))
  })

  it("never throws — the audited operation must not fail on audit failure", async () => {
    sqlMock.failOnce()
    await expect(audit("auth.login.success")).resolves.toBeUndefined()
  })
})

describe("audit wiring stays in place (source invariants)", () => {
  const read = (rel: string) =>
    readFile(path.resolve(import.meta.dirname, rel), "utf8")

  // file (relative to src/server) → audit actions that must appear in it.
  const WIRING: Record<string, Array<string>> = {
    "fns.auth.ts": [
      "auth.login.success",
      "auth.login.failure",
      "auth.login.throttled",
      "auth.logout",
    ],
    "fns.account.ts": ["account.password.change", "account.session.revoke"],
    "fns.users.ts": [
      "admin.user.create",
      "admin.user.update",
      "admin.user.delete",
      "admin.user.password_reset",
    ],
    "fns.households.ts": [
      "household.create",
      "household.member.add",
      "household.member.remove",
    ],
    "fns.setup.ts": ["setup.complete", "setup.token_rejected"],
    "finance/fns.accounts.ts": ["finance.account.delete"],
    "finance/fns.debts.ts": ["finance.debt.delete"],
    "../routes/api/admin/backup-db.ts": ["admin.backup.db_download"],
    "../routes/api/admin/backup-uploads.ts": ["admin.backup.uploads_download"],
  }

  for (const [file, actions] of Object.entries(WIRING)) {
    it(`${file} records ${actions.join(", ")}`, async () => {
      const src = await read(file)
      for (const action of actions) {
        expect(src, `${file} must audit "${action}"`).toContain(
          `audit("${action}"`
        )
      }
    })
  }
})
