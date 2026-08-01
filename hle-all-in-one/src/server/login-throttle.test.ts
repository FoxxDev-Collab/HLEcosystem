/**
 * REGRESSION TEST — login brute-force throttle (AC-7)
 *
 * v1 pre-release finding: loginFn ran an unthrottled bcrypt verify (~250ms
 * CPU, cost 12) per request with no attempt counter — a credential-stuffing
 * hole and an unauthenticated CPU-exhaustion vector in one. loginFn now
 * consults this throttle BEFORE any hashing.
 *
 * Invariants guarded here:
 *  - 5 consecutive failures on one email lock that email for 15 minutes,
 *    whether or not the account exists (no enumeration signal).
 *  - The lock expires on its own; a successful login clears the counter.
 *  - The per-IP backstop trips at 30 failures across many emails, and a
 *    success on one account does NOT refill a spraying IP.
 *  - The bucket map is bounded — a random-email flood cannot grow it
 *    past MAX_ENTRIES (memory-exhaustion guard).
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  EMAIL_MAX_FAILS,
  IP_MAX_FAILS,
  _throttleInternals,
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from "./login-throttle"

const T0 = 1_700_000_000_000
const MIN = 60 * 1000

describe("login throttle", () => {
  beforeEach(() => {
    _throttleInternals.emailStore.resetAll()
    _throttleInternals.ipStore.resetAll()
  })

  it("locks an email after 5 consecutive failures", () => {
    for (let i = 0; i < EMAIL_MAX_FAILS; i++) {
      expect(checkLoginAllowed("a@b.test", null, T0).allowed).toBe(true)
      recordLoginFailure("a@b.test", null, T0)
    }
    const verdict = checkLoginAllowed("a@b.test", null, T0)
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.retryAfterSec).toBeGreaterThan(0)
    // Case-insensitive: A@B.TEST is the same principal.
    expect(checkLoginAllowed("A@B.TEST", null, T0).allowed).toBe(false)
    // Other emails are unaffected.
    expect(checkLoginAllowed("c@d.test", null, T0).allowed).toBe(true)
  })

  it("lock expires after the lockout window", () => {
    for (let i = 0; i < EMAIL_MAX_FAILS; i++)
      recordLoginFailure("a@b.test", null, T0)
    expect(checkLoginAllowed("a@b.test", null, T0 + 14 * MIN).allowed).toBe(
      false
    )
    expect(checkLoginAllowed("a@b.test", null, T0 + 16 * MIN).allowed).toBe(
      true
    )
  })

  it("success clears the email counter", () => {
    for (let i = 0; i < EMAIL_MAX_FAILS - 1; i++)
      recordLoginFailure("a@b.test", null, T0)
    recordLoginSuccess("a@b.test")
    // Fresh slate: the next failures start counting from zero again.
    for (let i = 0; i < EMAIL_MAX_FAILS - 1; i++)
      recordLoginFailure("a@b.test", null, T0)
    expect(checkLoginAllowed("a@b.test", null, T0).allowed).toBe(true)
  })

  it("stale failures age out of the counting window", () => {
    for (let i = 0; i < EMAIL_MAX_FAILS - 1; i++)
      recordLoginFailure("a@b.test", null, T0)
    // 16 minutes later the window restarted — one more failure won't lock.
    recordLoginFailure("a@b.test", null, T0 + 16 * MIN)
    expect(checkLoginAllowed("a@b.test", null, T0 + 16 * MIN).allowed).toBe(
      true
    )
  })

  it("per-IP backstop trips across many emails and ignores per-account success", () => {
    for (let i = 0; i < IP_MAX_FAILS; i++)
      recordLoginFailure(`user${i}@spray.test`, "203.0.113.9", T0)
    // A success on one account must not unlock the spraying IP.
    recordLoginSuccess("user0@spray.test")
    const verdict = checkLoginAllowed("fresh@spray.test", "203.0.113.9", T0)
    expect(verdict.allowed).toBe(false)
    // Same email from a different IP is fine — the email itself isn't locked.
    expect(
      checkLoginAllowed("fresh@spray.test", "198.51.100.1", T0).allowed
    ).toBe(true)
    // No IP available (no proxy header): only the email dimension applies.
    expect(checkLoginAllowed("fresh@spray.test", null, T0).allowed).toBe(true)
  })

  it("bounds the bucket map under a random-email flood", () => {
    for (let i = 0; i < 6000; i++)
      recordLoginFailure(`rand${i}@flood.test`, null, T0 + i)
    expect(_throttleInternals.emailStore.size()).toBeLessThanOrEqual(5001)
  })
})
