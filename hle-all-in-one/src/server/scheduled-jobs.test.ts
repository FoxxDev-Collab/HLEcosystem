/**
 * Unit tests for the background scheduler's jobs (scripts/scheduler.ts).
 *
 * v1 pre-release finding: nothing in the deployment ran on a schedule — no
 * automatic backups, no expired-session pruning, recurring transactions only
 * on button press. These pin the job semantics; the pg_dump path is verified
 * live (it needs a real database and the postgres client).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  backupStamp,
  backupsToPrune,
  isBackupFile,
  processAllDueRecurring,
  pruneExpiredSessions,
} from "./scheduled-jobs"

type SqlRows = Array<Record<string, unknown>>

const { sqlMock } = vi.hoisted(() => {
  const calls: Array<string> = []
  let queue: Array<SqlRows> = []
  const tag = (strings: TemplateStringsArray, ..._values: Array<unknown>) => {
    calls.push(strings.join(" "))
    return Promise.resolve(queue.shift() ?? [])
  }
  const mock = Object.assign(tag, {
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

describe("pruneExpiredSessions", () => {
  beforeEach(() => sqlMock.reset())

  it("deletes only expired rows and reports the count", async () => {
    sqlMock.queueResults([{ id: "s1" }, { id: "s2" }])
    const removed = await pruneExpiredSessions()
    expect(removed).toBe(2)
    expect(sqlMock.calls).toHaveLength(1)
    expect(sqlMock.calls[0]).toMatch(
      /DELETE FROM "Session" WHERE "expiresAt" < now\(\)/
    )
  })
})

describe("processAllDueRecurring", () => {
  beforeEach(() => sqlMock.reset())

  it("sweeps every household and sums the created counts", async () => {
    sqlMock.queueResults(
      [{ id: "hh-1" }, { id: "hh-2" }, { id: "hh-3" }],
      [{ count: 2 }],
      [{ count: 0 }],
      [{ count: 1 }]
    )
    const result = await processAllDueRecurring()
    expect(result).toEqual({ households: 3, created: 3 })
    const fnCalls = sqlMock.calls.filter((c) => /process_due_recurring/.test(c))
    expect(fnCalls).toHaveLength(3)
  })

  it("does nothing when there are no households", async () => {
    sqlMock.queueResults([])
    const result = await processAllDueRecurring()
    expect(result).toEqual({ households: 0, created: 0 })
  })
})

describe("backup retention", () => {
  it("stamped names sort chronologically", () => {
    expect(backupStamp(new Date("2026-07-31T21:45:12Z"))).toBe(
      "2026-07-31-2145"
    )
    expect(isBackupFile("hle-aio-2026-07-31-2145.dump")).toBe(true)
    expect(isBackupFile(".hle-aio-2026-07-31-2145.dump.partial")).toBe(false)
  })

  it("prunes only the oldest dumps beyond the retention count", () => {
    const files = [
      "hle-aio-2026-07-29-0300.dump",
      "hle-aio-2026-07-31-0300.dump",
      "hle-aio-2026-07-30-0300.dump",
      "not-a-backup.txt",
      ".hle-aio-2026-08-01-0300.dump.partial",
    ]
    expect(backupsToPrune(files, 2)).toEqual(["hle-aio-2026-07-29-0300.dump"])
    expect(backupsToPrune(files, 3)).toEqual([])
    // retain=0 disables pruning entirely rather than deleting everything.
    expect(backupsToPrune(files, 0)).toEqual([])
  })
})
