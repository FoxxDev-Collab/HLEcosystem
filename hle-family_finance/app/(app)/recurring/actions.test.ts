/**
 * REGRESSION TEST — ADR-0005 household scoping (recurring transactions)
 *
 * Guards three mutations that previously had no auth gate:
 *   - toggleRecurringActiveAction
 *   - skipNextOccurrenceAction
 *   - deleteRecurringAction
 *
 * Each test simulates an attacker in household A attempting to mutate a
 * recurring transaction that belongs to household B. The handler must not
 * call any Prisma mutation method.
 *
 * See: docs/adr/0005-household-scoped-tenancy.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockGetCurrentUser, mockGetCurrentHouseholdId } = vi.hoisted(() => ({
  mockPrisma: {
    recurringTransaction: {
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    transaction: { create: vi.fn() },
    account: { update: vi.fn() },
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
  toggleRecurringActiveAction,
  skipNextOccurrenceAction,
  deleteRecurringAction,
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

describe("toggleRecurringActiveAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("passes householdId to the where clause so cross-household records are unreachable", async () => {
    mockPrisma.recurringTransaction.update.mockResolvedValueOnce({ id: "rec_A", isActive: false });

    await toggleRecurringActiveAction(
      makeFormData({ id: "rec_A", isActive: "true" })
    );

    expect(mockPrisma.recurringTransaction.update).toHaveBeenCalledWith({
      where: { id: "rec_A", householdId: HOUSEHOLD_A },
      data: { isActive: false },
    });
  });

  it("does not call update when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      toggleRecurringActiveAction(makeFormData({ id: "rec_B", isActive: "true" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.recurringTransaction.update).not.toHaveBeenCalled();
  });

  it("does not call update when householdId is missing", async () => {
    mockGetCurrentHouseholdId.mockResolvedValue(null);

    await expect(
      toggleRecurringActiveAction(makeFormData({ id: "rec_B", isActive: "true" }))
    ).rejects.toThrow("NEXT_REDIRECT:/setup");

    expect(mockPrisma.recurringTransaction.update).not.toHaveBeenCalled();
  });
});

describe("skipNextOccurrenceAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("rejects a foreign recurring transaction (findFirst returns null)", async () => {
    // Attacker supplies an ID from household B. The ownership-scoped findFirst
    // returns null because householdId doesn't match.
    mockPrisma.recurringTransaction.findFirst.mockResolvedValueOnce(null);

    await skipNextOccurrenceAction(makeFormData({ id: "rec_foreign" }));

    expect(mockPrisma.recurringTransaction.findFirst).toHaveBeenCalledWith({
      where: { id: "rec_foreign", householdId: HOUSEHOLD_A },
    });
    expect(mockPrisma.recurringTransaction.update).not.toHaveBeenCalled();
  });

  it("does not mutate when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      skipNextOccurrenceAction(makeFormData({ id: "rec_B" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.recurringTransaction.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.recurringTransaction.update).not.toHaveBeenCalled();
  });
});

describe("deleteRecurringAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("passes householdId to the delete where clause", async () => {
    mockPrisma.recurringTransaction.delete.mockResolvedValueOnce({ id: "rec_A" });

    await deleteRecurringAction(makeFormData({ id: "rec_A" }));

    expect(mockPrisma.recurringTransaction.delete).toHaveBeenCalledWith({
      where: { id: "rec_A", householdId: HOUSEHOLD_A },
    });
  });

  it("does not call delete when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      deleteRecurringAction(makeFormData({ id: "rec_B" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.recurringTransaction.delete).not.toHaveBeenCalled();
  });

  it("does not call delete when householdId is missing", async () => {
    mockGetCurrentHouseholdId.mockResolvedValue(null);

    await expect(
      deleteRecurringAction(makeFormData({ id: "rec_B" }))
    ).rejects.toThrow("NEXT_REDIRECT:/setup");

    expect(mockPrisma.recurringTransaction.delete).not.toHaveBeenCalled();
  });
});
