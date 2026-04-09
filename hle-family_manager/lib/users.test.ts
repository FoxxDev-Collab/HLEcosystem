import { describe, it, expect } from "vitest";
import { toPublic, type User } from "./users";

// toPublic() is the only sanctioned way to strip sensitive fields from a User
// row before it leaves the server. It is referenced in SECURITY_CONTROLS.md
// §IA-5 as the implementation of the "never expose password / TOTP secret"
// invariant. These tests guard that contract — if someone adds a new
// sensitive field to the User type without updating toPublic(), the last test
// in this file will start failing and block the PR in CI.

const fullUser: User = {
  id: "user_123",
  email: "alice@example.com",
  name: "Alice",
  password: "$2a$12$supersecrethashsupersecrethash",
  avatar: null,
  role: "MEMBER",
  active: true,
  totpSecret: "JBSWY3DPEHPK3PXP", // canonical RFC 6238 test secret
  totpEnabled: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

describe("toPublic", () => {
  it("strips the password field", () => {
    const pub = toPublic(fullUser);
    expect("password" in pub).toBe(false);
  });

  it("strips the totpSecret field", () => {
    const pub = toPublic(fullUser);
    expect("totpSecret" in pub).toBe(false);
  });

  it("preserves all non-sensitive fields verbatim", () => {
    const pub = toPublic(fullUser);
    expect(pub).toEqual({
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      avatar: fullUser.avatar,
      role: fullUser.role,
      active: fullUser.active,
      totpEnabled: fullUser.totpEnabled,
      createdAt: fullUser.createdAt,
      updatedAt: fullUser.updatedAt,
    });
  });

  it("preserves totpEnabled (not sensitive — only the secret is)", () => {
    const pub = toPublic({ ...fullUser, totpEnabled: true });
    expect(pub.totpEnabled).toBe(true);
  });

  // Regression guard: if the User type ever grows a new sensitive field, this
  // test will surface it because the returned object's keys will no longer
  // match the expected allow-list. Update the allow-list AND toPublic()
  // together when adding a field.
  it("returns only the documented public fields (allow-list guard)", () => {
    const pub = toPublic(fullUser);
    const actualKeys = Object.keys(pub).sort();
    const allowList = [
      "active",
      "avatar",
      "createdAt",
      "email",
      "id",
      "name",
      "role",
      "totpEnabled",
      "updatedAt",
    ];
    expect(actualKeys).toEqual(allowList);
  });
});
