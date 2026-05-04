import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockHousehold, mockGetCurrentUser } = vi.hoisted(() => ({
  mockUser: { findUnique: vi.fn() },
  mockHousehold: { create: vi.fn() },
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: mockUser, household: mockHousehold },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createHouseholdAction } from "./actions";

const buildFormData = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
};

describe("createHouseholdAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when no session is present", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await createHouseholdAction(
      null,
      buildFormData({ name: "The Smith Family" }),
    );

    expect(result).toEqual({
      error: "Not authenticated — please log in again",
    });
    expect(mockHousehold.create).not.toHaveBeenCalled();
  });

  it("returns validation error when name is empty", async () => {
    const result = await createHouseholdAction(
      null,
      buildFormData({ name: "   " }),
    );

    expect(result).toEqual({ error: "Household name is required" });
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  // Regression test for the cookie-name bug. Pre-fix, createHouseholdAction
  // read a non-existent "hub_user_id" cookie and always returned the
  // "Not authenticated" error even for logged-in admins. Post-fix it reads
  // the SSO session via getCurrentUser() and creates the household.
  it("creates a household for an authenticated user (regression for hub_user_id bug)", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user_admin",
      email: "admin@zulupf.com",
      name: "Admin",
    });
    mockUser.findUnique.mockResolvedValue({
      id: "user_admin",
      name: "Admin",
    });
    mockHousehold.create.mockResolvedValue({
      id: "household_new",
      name: "The Smith Family",
    });

    const result = await createHouseholdAction(
      null,
      buildFormData({ name: "The Smith Family" }),
    );

    expect(result).toBeNull();
    expect(mockHousehold.create).toHaveBeenCalledWith({
      data: {
        name: "The Smith Family",
        members: {
          create: [
            {
              userId: "user_admin",
              displayName: "Admin",
              role: "ADMIN",
              familyRelationship: "Spouse",
            },
          ],
        },
      },
    });
  });

  it("includes the spouse as a second household member when provided", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user_admin",
      email: "admin@zulupf.com",
      name: "Admin",
    });
    mockUser.findUnique
      .mockResolvedValueOnce({ id: "user_admin", name: "Admin" })
      .mockResolvedValueOnce({ id: "user_spouse", name: "Spouse" });
    mockHousehold.create.mockResolvedValue({
      id: "household_new",
      name: "Smith",
    });

    const result = await createHouseholdAction(
      null,
      buildFormData({ name: "Smith", spouseUserId: "user_spouse" }),
    );

    expect(result).toBeNull();
    const arg = mockHousehold.create.mock.calls[0][0];
    expect(arg.data.members.create).toHaveLength(2);
    expect(arg.data.members.create[1]).toEqual({
      userId: "user_spouse",
      displayName: "Spouse",
      role: "ADMIN",
      familyRelationship: "Spouse",
    });
  });
});
