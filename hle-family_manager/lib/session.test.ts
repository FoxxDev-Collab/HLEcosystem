import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the prisma singleton before importing anything that uses it.
// vi.mock() is hoisted to the top of the file, so the mock factory cannot
// close over module-level variables directly. vi.hoisted() lets us share
// the same vi.fn() handles between the factory and the test assertions.
const { mockSession } = vi.hoisted(() => ({
  mockSession: {
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("./prisma", () => ({
  prisma: { session: mockSession },
}));

// Import after the mock is installed so the module picks up the mocked prisma
import {
  generateSessionToken,
  validateSession,
} from "./session";

describe("generateSessionToken", () => {
  it("returns a 128-character hex string (64 bytes = 512 bits entropy)", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{128}$/);
  });

  it("produces a unique token on every call (sanity check for CSPRNG)", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateSessionToken());
    expect(tokens.size).toBe(100);
  });
});

describe("validateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseUser = {
    id: "user_1",
    email: "alice@example.com",
    name: "Alice",
    password: "$2a$12$hash",
    avatar: null,
    role: "MEMBER" as const,
    active: true,
    totpSecret: "JBSWY3DPEHPK3PXP",
    totpEnabled: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("returns null when the session does not exist", async () => {
    mockSession.findUnique.mockResolvedValueOnce(null);
    const result = await validateSession("nonexistent_token");
    expect(result).toBeNull();
  });

  it("returns null and deletes the row when the session is expired", async () => {
    const expiredAt = new Date(Date.now() - 1000); // 1s ago
    mockSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      userId: baseUser.id,
      expiresAt: expiredAt,
      user: baseUser,
    });
    mockSession.delete.mockResolvedValueOnce({});

    const result = await validateSession("expired_token");

    expect(result).toBeNull();
    expect(mockSession.delete).toHaveBeenCalledWith({ where: { id: "sess_1" } });
  });

  it("returns null when the underlying user is inactive (account disabled)", async () => {
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60);
    mockSession.findUnique.mockResolvedValueOnce({
      id: "sess_2",
      userId: baseUser.id,
      expiresAt: futureExpiry,
      user: { ...baseUser, active: false },
    });

    const result = await validateSession("valid_token_inactive_user");

    // Critical security boundary: even if a valid session exists, a disabled
    // user must not be able to resume. See SECURITY_CONTROLS.md §AC-2.
    expect(result).toBeNull();
  });

  it("returns the session and sanitized user for a valid live session", async () => {
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60);
    mockSession.findUnique.mockResolvedValueOnce({
      id: "sess_3",
      userId: baseUser.id,
      expiresAt: futureExpiry,
      user: baseUser,
    });

    const result = await validateSession("valid_token");

    expect(result).not.toBeNull();
    expect(result!.session).toEqual({ id: "sess_3", userId: baseUser.id });
    // The returned user MUST NOT contain password or totpSecret —
    // validateSession is the primary code path that turns a Session DB row
    // into a UserPublic. A regression here would leak secrets to every
    // consumer of the auth system across all 10 apps.
    expect("password" in result!.user).toBe(false);
    expect("totpSecret" in result!.user).toBe(false);
    expect(result!.user.id).toBe(baseUser.id);
    expect(result!.user.email).toBe(baseUser.email);
  });
});
