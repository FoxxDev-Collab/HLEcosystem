import { describe, expect, it } from "vitest"
import { canManageHousehold } from "./privileges"

// The household-privilege rule (media management, irreversible finance
// deletes): household OWNER or instance ADMIN. Guards against regressing to
// the instance-ADMIN-only gate this replaced, which locked household owners
// out of their own library management.
describe("canManageHousehold", () => {
  const ctx = (role: "ADMIN" | "MEMBER", household: "OWNER" | "MEMBER") => ({
    user: { role },
    membership: { role: household },
  })

  it("allows a household OWNER who is an instance MEMBER", () => {
    expect(canManageHousehold(ctx("MEMBER", "OWNER"))).toBe(true)
  })

  it("allows an instance ADMIN who is a household MEMBER", () => {
    expect(canManageHousehold(ctx("ADMIN", "MEMBER"))).toBe(true)
  })

  it("allows an instance ADMIN who is also the OWNER", () => {
    expect(canManageHousehold(ctx("ADMIN", "OWNER"))).toBe(true)
  })

  it("denies a plain member", () => {
    expect(canManageHousehold(ctx("MEMBER", "MEMBER"))).toBe(false)
  })
})
