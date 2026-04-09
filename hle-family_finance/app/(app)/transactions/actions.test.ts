/**
 * REGRESSION TEST — ADR-0005 household scoping incident (2026-04-08)
 *
 * On 2026-04-08, a security audit caught that createTransactionAction()
 * updated Account.currentBalance by accountId alone, without verifying
 * that the account belonged to the caller's household. An attacker
 * submitting a form with an arbitrary accountId could mutate another
 * household's account balance.
 *
 * The fix was to re-verify account ownership via a findFirst scoped by
 * both id and householdId before any balance mutation.
 *
 * This test suite guards that fix. It simulates the exact attack by:
 *  1. Logging in as a legitimate user in household A
 *  2. Submitting a createTransaction form that references accountId "acct_B"
 *     (belonging to household B)
 *  3. Asserting that prisma.account.update() is NEVER called
 *  4. Asserting that prisma.transaction.create() is NEVER called
 *
 * If this test ever fails, the tenancy boundary has been breached again.
 * Do not mark it as flaky, do not delete it, do not skip it — stop and
 * read docs/adr/0005-household-scoped-tenancy.md before touching anything.
 *
 * See: docs/adr/0005-household-scoped-tenancy.md
 * See: docs/THREAT_MODEL.md §4 TB-1 "Tampering"
 * See: docs/SECURITY_CONTROLS.md §AC-3
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock factories must be hoisted so vi.mock() calls can reference them.
const { mockPrisma, mockGetCurrentUser, mockGetCurrentHouseholdId } = vi.hoisted(() => ({
  mockPrisma: {
    account: { findFirst: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  mockGetCurrentUser: vi.fn(),
  mockGetCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: mockGetCurrentHouseholdId,
}));

// Next.js imports referenced by the module under test
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// The claude-api helper is called by suggestCategoryAction, which we don't test here
vi.mock("@/lib/claude-api", () => ({ categorizeTransaction: vi.fn() }));

// Import the module under test AFTER all mocks are installed
import {
  createTransactionAction,
  deleteTransactionAction,
} from "./actions";

const HOUSEHOLD_A = "household_alice";
const HOUSEHOLD_B = "household_bob";

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

describe("createTransactionAction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("rejects a transaction whose accountId belongs to a different household", async () => {
    // Attacker (Alice, household A) submits a form referencing an account
    // in household B. The account.findFirst gate must return null because
    // the query is `{ id: acct_B, householdId: household_A }` — no match.
    mockPrisma.account.findFirst.mockResolvedValueOnce(null);

    await createTransactionAction(
      makeFormData({
        type: "EXPENSE",
        accountId: "acct_B", // foreign account
        amount: "50.00",
        date: "2026-04-08",
      })
    );

    // The ownership check must have been called with the current household
    expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
      where: { id: "acct_B", householdId: HOUSEHOLD_A },
    });

    // Critical assertions — the breach is any of these being called:
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.account.update).not.toHaveBeenCalled();
  });

  it("rejects a TRANSFER whose destination accountId belongs to a different household", async () => {
    // Source account is valid (household A). Destination account is in household B.
    // The second findFirst (for transferToAccountId) must return null and the
    // entire operation must abort without mutating anything.
    mockPrisma.account.findFirst
      .mockResolvedValueOnce({ id: "acct_A", householdId: HOUSEHOLD_A, currentBalance: 1000 }) // source
      .mockResolvedValueOnce(null); // destination not in household A

    await createTransactionAction(
      makeFormData({
        type: "TRANSFER",
        accountId: "acct_A",
        transferToAccountId: "acct_B", // foreign
        amount: "200.00",
        date: "2026-04-08",
      })
    );

    expect(mockPrisma.account.findFirst).toHaveBeenCalledTimes(2);
    expect(mockPrisma.account.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: "acct_B", householdId: HOUSEHOLD_A },
    });

    // No mutation should have occurred
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.account.update).not.toHaveBeenCalled();
  });

  it("allows a legitimate EXPENSE in the user's own household", async () => {
    mockPrisma.account.findFirst.mockResolvedValueOnce({
      id: "acct_A",
      householdId: HOUSEHOLD_A,
      currentBalance: 1000,
    });
    mockPrisma.transaction.create.mockResolvedValueOnce({ id: "txn_1" });
    mockPrisma.account.update.mockResolvedValueOnce({});

    await createTransactionAction(
      makeFormData({
        type: "EXPENSE",
        accountId: "acct_A",
        amount: "50.00",
        date: "2026-04-08",
      })
    );

    expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.account.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.account.update).toHaveBeenCalledWith({
      where: { id: "acct_A" },
      data: { currentBalance: { decrement: 50 } },
    });
  });

  it("rejects the request when input fails zod validation (defense in depth)", async () => {
    // Amount is non-numeric; zod safeParse should fail and the handler must
    // return without touching the DB. Verifies the input validation gate.
    await createTransactionAction(
      makeFormData({
        type: "EXPENSE",
        accountId: "acct_A",
        amount: "not_a_number",
        date: "2026-04-08",
      })
    );

    expect(mockPrisma.account.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.account.update).not.toHaveBeenCalled();
  });
});

describe("deleteTransactionAction — auth + household scoping gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(aliceUser);
    mockGetCurrentHouseholdId.mockResolvedValue(HOUSEHOLD_A);
  });

  it("refuses to delete a transaction that does not belong to the current household", async () => {
    // findUnique with { id, householdId } returns null because the transaction
    // id exists but householdId doesn't match. The handler must not call delete.
    mockPrisma.transaction.findUnique.mockResolvedValueOnce(null);

    await deleteTransactionAction(makeFormData({ id: "txn_foreign" }));

    expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith({
      where: { id: "txn_foreign", householdId: HOUSEHOLD_A },
    });
    expect(mockPrisma.transaction.delete).not.toHaveBeenCalled();
    expect(mockPrisma.account.update).not.toHaveBeenCalled();
  });
});
