/**
 * REGRESSION TEST — ADR-0005 household scoping incident (2026-04-08)
 *
 * On 2026-04-08, a security audit caught that the legacy finance app's
 * createTransactionAction() updated Account.currentBalance by accountId
 * alone, without verifying that the account belonged to the caller's
 * household. An attacker submitting a form with an arbitrary accountId could
 * mutate another household's account balance.
 *
 * The fix was to re-verify account ownership via a lookup scoped by both id
 * and householdId before any mutation. In this monolith the same invariants
 * hold in src/server/finance/transactions.ts:
 *
 *  - createTransaction() re-verifies accountId (and BOTH legs of a TRANSFER)
 *    against the middleware-verified householdId before the INSERT.
 *  - The app layer NEVER updates Account.currentBalance — the
 *    sync_account_balance() DB trigger owns it (migrations/0009_finance.sql).
 *  - deleteTransaction() does a scoped { id, householdId } lookup before the
 *    DELETE.
 *  - createTransactionSchema rejects malformed input before any DB call
 *    (the fns layer wires it into .inputValidator()).
 *
 * If this test ever fails, the tenancy boundary has been breached again.
 * Do not mark it as flaky, do not delete it, do not skip it — stop and read
 * HLEcosystem/docs/adr/0005-household-scoped-tenancy.md before touching
 * anything.
 *
 * See: docs/adr/0005-household-scoped-tenancy.md
 * See: docs/THREAT_MODEL.md §4 TB-1 "Tampering"
 * See: docs/SECURITY_CONTROLS.md §AC-3
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
// vi.mock("@/server/db") below is hoisted by vitest above this import, so the
// module under test always receives the mocked sql client.
import {
  createTransaction,
  createTransactionSchema,
  deleteTransaction,
} from "./transactions"

type SqlRows = Array<Record<string, unknown>>

// Tagged-template mock for Bun.sql: records every issued query's text and
// returns queued results in order (empty array once the queue is drained —
// i.e. "no rows matched").
const { sqlMock } = vi.hoisted(() => {
  const calls: Array<string> = []
  let queue: Array<SqlRows> = []
  const tag = (strings: TemplateStringsArray, ..._values: Array<unknown>) => {
    calls.push(strings.join(" "))
    return Promise.resolve(queue.shift() ?? [])
  }
  const mock = Object.assign(tag, {
    begin: async (cb: (tx: typeof tag) => Promise<unknown>) => cb(tag),
    queueResults: (...results: Array<SqlRows>) => {
      queue = [...results]
    },
    calls,
    reset: () => {
      calls.length = 0
      queue = []
    },
  })
  return { sqlMock: mock }
})

vi.mock("@/server/db", () => ({ sql: sqlMock }))

const HOUSEHOLD_A = "household_alice"
const USER_ALICE = "user_alice"

const callsMatching = (re: RegExp) => sqlMock.calls.filter((q) => re.test(q))
const transactionInserts = () => callsMatching(/INSERT INTO "Transaction"/i)
const accountBalanceUpdates = () => callsMatching(/UPDATE "Account"/i)
const transactionDeletes = () => callsMatching(/DELETE FROM "Transaction"/i)

const baseInput = {
  type: "EXPENSE" as const,
  accountId: "acct_B",
  categoryId: null,
  amount: 50,
  date: "2026-04-08",
  payee: null,
  description: null,
  transferToAccountId: null,
}

describe("createTransaction — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("rejects a transaction whose accountId belongs to a different household", async () => {
    // Attacker (Alice, household A) submits a foreign accountId. The
    // ownership lookup is scoped { id, householdId } so it returns no rows.
    sqlMock.queueResults([])

    const result = await createTransaction(HOUSEHOLD_A, USER_ALICE, {
      ...baseInput,
      accountId: "acct_B", // foreign account
    })

    expect(result).toEqual({ error: "Account not found" })

    // The ownership check must have been scoped by BOTH id and householdId.
    const ownershipChecks = callsMatching(
      /SELECT "id" FROM "Account"\s+WHERE "id" = \s+AND "householdId" =/
    )
    expect(ownershipChecks).toHaveLength(1)

    // Critical assertions — the breach is any of these being issued:
    expect(transactionInserts()).toHaveLength(0)
    expect(accountBalanceUpdates()).toHaveLength(0)
  })

  it("rejects a TRANSFER whose destination accountId belongs to a different household", async () => {
    // Source account is valid (household A). Destination is in household B:
    // the second scoped lookup returns no rows and the entire operation must
    // abort without mutating anything.
    sqlMock.queueResults([{ id: "acct_A" }], [])

    const result = await createTransaction(HOUSEHOLD_A, USER_ALICE, {
      ...baseInput,
      type: "TRANSFER",
      accountId: "acct_A",
      transferToAccountId: "acct_B", // foreign
      amount: 200,
    })

    expect(result).toEqual({ error: "Destination account not found" })

    // BOTH legs were re-verified with household-scoped lookups.
    const ownershipChecks = callsMatching(
      /SELECT "id" FROM "Account"\s+WHERE "id" = \s+AND "householdId" =/
    )
    expect(ownershipChecks).toHaveLength(2)

    expect(transactionInserts()).toHaveLength(0)
    expect(accountBalanceUpdates()).toHaveLength(0)
  })

  it("allows a legitimate EXPENSE and lets the DB trigger own the balance", async () => {
    sqlMock.queueResults([{ id: "acct_A" }])

    const result = await createTransaction(HOUSEHOLD_A, USER_ALICE, {
      ...baseInput,
      accountId: "acct_A",
    })

    expect(result).toEqual({ ok: true })
    expect(transactionInserts()).toHaveLength(1)
    // Balance updates are handled by the sync_account_balance DB trigger on
    // INSERT — the application layer must NOT update Account directly.
    expect(accountBalanceUpdates()).toHaveLength(0)
  })

  it("rejects the request when input fails zod validation (defense in depth)", () => {
    // Amount is non-numeric; the schema (wired into .inputValidator() in
    // fns.transactions.ts) must fail before the handler — and therefore any
    // DB call — runs.
    const parsed = createTransactionSchema.safeParse({
      ...baseInput,
      accountId: "acct_A",
      amount: "not_a_number",
    })

    expect(parsed.success).toBe(false)
    expect(sqlMock.calls).toHaveLength(0)
  })
})

describe("deleteTransaction — household scoping gate", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("refuses to delete a transaction that does not belong to the current household", async () => {
    // The scoped { id, householdId } lookup returns no rows because the
    // transaction belongs to another household. No DELETE may run.
    sqlMock.queueResults([])

    const result = await deleteTransaction(HOUSEHOLD_A, "txn_foreign")

    expect(result).toEqual({ error: "Transaction not found" })

    const scopedLookups = callsMatching(
      /SELECT "id" FROM "Transaction"\s+WHERE "id" = \s+AND "householdId" =/
    )
    expect(scopedLookups).toHaveLength(1)

    expect(transactionDeletes()).toHaveLength(0)
    expect(accountBalanceUpdates()).toHaveLength(0)
  })
})
