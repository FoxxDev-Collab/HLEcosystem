/**
 * REGRESSION TEST — ADR-0005 household scoping (budget planner)
 *
 * Guards five mutations that previously had no auth gate or no householdId
 * in their WHERE clause:
 *   - updateProjectStatusAction
 *   - addItemAction
 *   - toggleItemPurchasedAction
 *   - deleteItemAction
 *   - duplicateProjectAction (reads foreign project without ownership check)
 *
 * Each test simulates an attacker in household A targeting resources that
 * belong to household B. No Prisma mutation method should be called.
 *
 * See: docs/adr/0005-household-scoped-tenancy.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockGetCurrentUser, mockGetCurrentHouseholdId } = vi.hoisted(() => ({
  mockPrisma: {
    budgetPlannerProject: {
      update: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    budgetPlannerItem: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
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
  updateProjectStatusAction,
  addItemAction,
  toggleItemPurchasedAction,
  deleteItemAction,
  duplicateProjectAction,
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

describe("updateProjectStatusAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("includes householdId in the where clause", async () => {
    mockPrisma.budgetPlannerProject.update.mockResolvedValueOnce({ id: "proj_A" });

    await updateProjectStatusAction(
      makeFormData({ id: "proj_A", status: "COMPLETED" })
    );

    expect(mockPrisma.budgetPlannerProject.update).toHaveBeenCalledWith({
      where: { id: "proj_A", householdId: HOUSEHOLD_A },
      data: { status: "COMPLETED" },
    });
  });

  it("does not call update when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      updateProjectStatusAction(makeFormData({ id: "proj_B", status: "CANCELLED" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.budgetPlannerProject.update).not.toHaveBeenCalled();
  });
});

describe("addItemAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("rejects item creation when the project belongs to a different household", async () => {
    // Attacker submits a projectId from household B. The ownership findFirst
    // returns null because householdId doesn't match.
    mockPrisma.budgetPlannerProject.findFirst.mockResolvedValueOnce(null);

    await addItemAction(
      makeFormData({
        projectId: "proj_B",
        name: "Malicious item",
        quantity: "1",
        unitCost: "100",
      })
    );

    expect(mockPrisma.budgetPlannerProject.findFirst).toHaveBeenCalledWith({
      where: { id: "proj_B", householdId: HOUSEHOLD_A },
    });
    expect(mockPrisma.budgetPlannerItem.create).not.toHaveBeenCalled();
  });

  it("does not create an item when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      addItemAction(makeFormData({ projectId: "proj_B", name: "X", quantity: "1", unitCost: "1" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.budgetPlannerProject.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.budgetPlannerItem.create).not.toHaveBeenCalled();
  });
});

describe("toggleItemPurchasedAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("rejects toggle when the item's project belongs to a different household", async () => {
    mockPrisma.budgetPlannerItem.findFirst.mockResolvedValueOnce(null);

    await toggleItemPurchasedAction(
      makeFormData({ id: "item_foreign", isPurchased: "false" })
    );

    expect(mockPrisma.budgetPlannerItem.findFirst).toHaveBeenCalledWith({
      where: { id: "item_foreign", project: { householdId: HOUSEHOLD_A } },
    });
    expect(mockPrisma.budgetPlannerItem.update).not.toHaveBeenCalled();
  });

  it("does not toggle when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      toggleItemPurchasedAction(makeFormData({ id: "item_B", isPurchased: "false" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.budgetPlannerItem.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.budgetPlannerItem.update).not.toHaveBeenCalled();
  });
});

describe("deleteItemAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("rejects deletion when the item's project belongs to a different household", async () => {
    mockPrisma.budgetPlannerItem.findFirst.mockResolvedValueOnce(null);

    await deleteItemAction(makeFormData({ id: "item_foreign" }));

    expect(mockPrisma.budgetPlannerItem.findFirst).toHaveBeenCalledWith({
      where: { id: "item_foreign", project: { householdId: HOUSEHOLD_A } },
    });
    expect(mockPrisma.budgetPlannerItem.delete).not.toHaveBeenCalled();
  });

  it("does not delete when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      deleteItemAction(makeFormData({ id: "item_B" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.budgetPlannerItem.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.budgetPlannerItem.delete).not.toHaveBeenCalled();
  });
});

describe("duplicateProjectAction — foreign project read prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("does not create a duplicate when the source project belongs to a different household", async () => {
    // Attacker supplies a sourceId from household B. findFirst with householdId
    // returns null, so no project is created.
    mockPrisma.budgetPlannerProject.findFirst.mockResolvedValueOnce(null);

    await duplicateProjectAction(makeFormData({ id: "proj_foreign" }));

    expect(mockPrisma.budgetPlannerProject.findFirst).toHaveBeenCalledWith({
      where: { id: "proj_foreign", householdId: HOUSEHOLD_A },
      include: { items: true },
    });
    expect(mockPrisma.budgetPlannerProject.create).not.toHaveBeenCalled();
    expect(mockPrisma.budgetPlannerItem.createMany).not.toHaveBeenCalled();
  });
});
