/**
 * REGRESSION TEST — ADR-0005 household scoping (budget planner)
 *
 * Ported from hle-family_finance/app/(app)/budget-planner/actions.test.ts.
 * The legacy test guarded five mutations that previously had no auth gate or
 * no householdId in their WHERE clause:
 *   - updateProjectStatus
 *   - addItem (foreign projectId)
 *   - toggleItemPurchased (foreign item, scoped through the parent project)
 *   - deleteItem (foreign item)
 *   - duplicateProject (foreign project read prevention)
 *
 * Each test simulates an attacker in household A targeting resources that
 * belong to household B: the scoped lookup/UPDATE matches nothing, so no
 * mutation may be issued.
 *
 * The legacy "unauthenticated user" assertions do not survive the port —
 * authentication is owned by householdMiddleware (fns.budget-planner.ts),
 * which redirects before the query layer is ever reached.
 *
 * See: docs/adr/0005-household-scoped-tenancy.md
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
// vi.mock("@/server/db") below is hoisted by vitest above this import, so the
// module under test always receives the mocked sql client.
import {
  addItem,
  deleteItem,
  duplicateProject,
  toggleItemPurchased,
  updateProjectStatus,
} from "./budget-planner"

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

const callsMatching = (re: RegExp) => sqlMock.calls.filter((q) => re.test(q))
const itemInserts = () => callsMatching(/INSERT INTO "BudgetPlannerItem"/i)
const itemUpdates = () => callsMatching(/UPDATE "BudgetPlannerItem"/i)
const itemDeletes = () => callsMatching(/DELETE FROM "BudgetPlannerItem"/i)
const projectInserts = () =>
  callsMatching(/INSERT INTO "BudgetPlannerProject"/i)

describe("updateProjectStatus — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("scopes the UPDATE by both id and householdId", async () => {
    sqlMock.queueResults([{ id: "proj_A" }])

    const result = await updateProjectStatus(HOUSEHOLD_A, "proj_A", "COMPLETED")

    expect(result).toEqual({ ok: true })
    const scopedUpdates = callsMatching(
      /UPDATE "BudgetPlannerProject"[\s\S]*WHERE "id" = \s*AND "householdId" =/
    )
    expect(scopedUpdates).toHaveLength(1)
  })

  it("returns an error (and matches nothing) for a foreign project", async () => {
    // The scoped UPDATE ... RETURNING matches no rows for household B's id.
    sqlMock.queueResults([])

    const result = await updateProjectStatus(
      HOUSEHOLD_A,
      "proj_foreign",
      "CANCELLED"
    )

    expect(result).toEqual({ error: "Project not found" })
  })
})

describe("addItem — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("rejects item creation when the project belongs to a different household", async () => {
    // Attacker submits a projectId from household B. The ownership lookup is
    // scoped { id, householdId } so it returns no rows.
    sqlMock.queueResults([])

    const result = await addItem(HOUSEHOLD_A, "proj_B", {
      name: "Malicious item",
      description: null,
      quantity: 1,
      unitCost: 100,
      referenceUrl: null,
    })

    expect(result).toEqual({ error: "Project not found" })

    const ownershipChecks = callsMatching(
      /SELECT "id" FROM "BudgetPlannerProject"\s+WHERE "id" = \s*AND "householdId" =/
    )
    expect(ownershipChecks).toHaveLength(1)
    expect(itemInserts()).toHaveLength(0)
  })
})

describe("toggleItemPurchased — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("rejects toggle when the item's project belongs to a different household", async () => {
    // The scoped lookup joins through the parent project and matches nothing.
    sqlMock.queueResults([])

    const result = await toggleItemPurchased(HOUSEHOLD_A, "item_foreign")

    expect(result).toEqual({ error: "Item not found" })

    const scopedLookups = callsMatching(
      /JOIN "BudgetPlannerProject" p[\s\S]*WHERE i\."id" = \s*AND p\."householdId" =/
    )
    expect(scopedLookups).toHaveLength(1)
    expect(itemUpdates()).toHaveLength(0)
  })
})

describe("deleteItem — ADR-0005 household scoping regression", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("rejects deletion when the item's project belongs to a different household", async () => {
    sqlMock.queueResults([])

    const result = await deleteItem(HOUSEHOLD_A, "item_foreign")

    expect(result).toEqual({ error: "Item not found" })

    const scopedLookups = callsMatching(
      /JOIN "BudgetPlannerProject" p[\s\S]*WHERE i\."id" = \s*AND p\."householdId" =/
    )
    expect(scopedLookups).toHaveLength(1)
    expect(itemDeletes()).toHaveLength(0)
  })
})

describe("duplicateProject — foreign project read prevention", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("does not create a duplicate when the source project belongs to a different household", async () => {
    // Attacker supplies a sourceId from household B. The scoped SELECT
    // returns no rows, so nothing is created.
    sqlMock.queueResults([])

    const result = await duplicateProject(HOUSEHOLD_A, "proj_foreign")

    expect(result).toEqual({ error: "Project not found" })

    const ownershipChecks = callsMatching(
      /FROM "BudgetPlannerProject"\s+WHERE "id" = \s*AND "householdId" =/
    )
    expect(ownershipChecks).toHaveLength(1)
    expect(projectInserts()).toHaveLength(0)
    expect(itemInserts()).toHaveLength(0)
  })
})
