/**
 * REGRESSION TEST — ADR-0005 household scoping (categories)
 *
 * Guards two mutations that previously accepted a bare ID with no
 * householdId scope in the WHERE clause:
 *   - updateCategoryAction
 *   - archiveCategoryAction
 *
 * Also verifies that both functions now require a valid user session,
 * which was entirely absent from the original file.
 *
 * See: docs/adr/0005-household-scoped-tenancy.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockGetCurrentUser, mockGetCurrentHouseholdId } = vi.hoisted(() => ({
  mockPrisma: {
    category: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  mockGetCurrentUser: vi.fn(),
  mockGetCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/household", () => ({ getCurrentHouseholdId: mockGetCurrentHouseholdId }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Next.js redirect() throws internally to halt execution — simulate that behavior
vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

import {
  updateCategoryAction,
  archiveCategoryAction,
} from "./actions";

const HOUSEHOLD_A = "household_alice";

const aliceUser = {
  id: "user_alice",
  email: "alice@example.com",
  name: "Alice",
  avatar: null,
  role: "MEMBER" as const,
  active: true,
  totpEnabled: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("updateCategoryAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("includes householdId in the where clause so cross-household categories are unreachable", async () => {
    mockPrisma.category.update.mockResolvedValueOnce({ id: "cat_A" });

    await updateCategoryAction(
      makeFormData({ id: "cat_A", name: "Groceries", color: "#ff0000" })
    );

    expect(mockPrisma.category.update).toHaveBeenCalledWith({
      where: { id: "cat_A", householdId: HOUSEHOLD_A },
      data: { name: "Groceries", color: "#ff0000" },
    });
  });

  it("does not call update when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      updateCategoryAction(makeFormData({ id: "cat_B", name: "Attack" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.category.update).not.toHaveBeenCalled();
  });

  it("does not call update when householdId is missing", async () => {
    mockGetCurrentHouseholdId.mockResolvedValue(null);

    await expect(
      updateCategoryAction(makeFormData({ id: "cat_B", name: "Attack" }))
    ).rejects.toThrow("NEXT_REDIRECT:/setup");

    expect(mockPrisma.category.update).not.toHaveBeenCalled();
  });
});

describe("archiveCategoryAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("includes householdId in the where clause", async () => {
    mockPrisma.category.update.mockResolvedValueOnce({ id: "cat_A" });

    await archiveCategoryAction(
      makeFormData({ id: "cat_A", isArchived: "false" })
    );

    expect(mockPrisma.category.update).toHaveBeenCalledWith({
      where: { id: "cat_A", householdId: HOUSEHOLD_A },
      data: { isArchived: true },
    });
  });

  it("does not call update when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      archiveCategoryAction(makeFormData({ id: "cat_B", isArchived: "false" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.category.update).not.toHaveBeenCalled();
  });
});
