import { describe, expect, it } from "vitest"
import { canManageMedia } from "./manage"

// The media-management privilege rule (scan, enrich, parental controls):
// household OWNER or instance ADMIN. Guards against regressing to the
// instance-ADMIN-only gate this replaced, which locked household owners out
// of their own library management.
describe("canManageMedia", () => {
  const ctx = (role: "ADMIN" | "MEMBER", household: "OWNER" | "MEMBER") => ({
    user: { role },
    membership: { role: household },
  })

  it("allows a household OWNER who is an instance MEMBER", () => {
    expect(canManageMedia(ctx("MEMBER", "OWNER"))).toBe(true)
  })

  it("allows an instance ADMIN who is a household MEMBER", () => {
    expect(canManageMedia(ctx("ADMIN", "MEMBER"))).toBe(true)
  })

  it("allows an instance ADMIN who is also the OWNER", () => {
    expect(canManageMedia(ctx("ADMIN", "OWNER"))).toBe(true)
  })

  it("denies a plain member", () => {
    expect(canManageMedia(ctx("MEMBER", "MEMBER"))).toBe(false)
  })
})
