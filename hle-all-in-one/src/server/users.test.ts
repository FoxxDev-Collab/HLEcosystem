/**
 * Guards the admin user-provisioning flow.
 *
 * v1 pre-release finding: createUserFn created the User row and stopped —
 * initial household placement was a separate flow on a different page, keyed
 * by re-typing the same email. Forgetting it stranded the new account with no
 * household (every module redirects it to /setup). createUser() now accepts
 * an optional membership and creates both rows in ONE transaction, so a
 * failed membership insert can never leave a half-provisioned account.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createUser } from "./users"

type SqlRows = Array<Record<string, unknown>>

// Tagged-template mock for Bun.sql: records every issued query's text and
// returns queued results in order. `begin` runs the callback with the same
// tag and counts invocations so tests can assert transactional execution.
const { sqlMock } = vi.hoisted(() => {
  const calls: Array<string> = []
  let queue: Array<SqlRows> = []
  let beginCalls = 0
  let failOn: RegExp | null = null
  const tag = (strings: TemplateStringsArray, ..._values: Array<unknown>) => {
    const text = strings.join(" ")
    calls.push(text)
    if (failOn && failOn.test(text)) {
      return Promise.reject(new Error("violates foreign key constraint"))
    }
    return Promise.resolve(queue.shift() ?? [])
  }
  const mock = Object.assign(tag, {
    begin: async (cb: (tx: typeof tag) => Promise<unknown>) => {
      beginCalls++
      return cb(tag)
    },
    queueResults: (...results: Array<SqlRows>) => {
      queue = [...results]
    },
    failNextMatching: (re: RegExp | null) => {
      failOn = re
    },
    calls,
    // A method, not a getter — Object.assign would snapshot a getter's value.
    beginCount: () => beginCalls,
    reset: () => {
      calls.length = 0
      queue = []
      beginCalls = 0
      failOn = null
    },
  })
  return { sqlMock: mock }
})

vi.mock("@/server/db", () => ({ sql: sqlMock }))

// createUser hashes via the Bun global; vitest runs in a node environment
// where it may be absent. Stub deterministically either way.
vi.stubGlobal("Bun", {
  password: { hash: async () => "hashed-password" },
})

const callsMatching = (re: RegExp) => sqlMock.calls.filter((q) => re.test(q))
const userInserts = () => callsMatching(/INSERT INTO "User"/i)
const membershipInserts = () => callsMatching(/INSERT INTO "HouseholdMember"/i)

const input = {
  email: "kid@example.test",
  firstName: "Kid",
  lastName: "Example",
  password: "Sup3rSecret!pw",
  role: "MEMBER" as const,
}

const insertedUser = {
  id: "user_new",
  email: input.email,
  firstName: input.firstName,
  lastName: input.lastName,
  password: "hashed-password",
  avatar: null,
  role: "MEMBER",
  active: true,
  totpEnabled: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

describe("createUser — initial household placement", () => {
  beforeEach(() => {
    sqlMock.reset()
  })

  it("creates the user AND the membership inside one transaction", async () => {
    sqlMock.queueResults([insertedUser], [])

    const user = await createUser(input, {
      householdId: "household_a",
      role: "MEMBER",
    })

    expect(sqlMock.beginCount()).toBe(1)
    expect(userInserts()).toHaveLength(1)
    expect(membershipInserts()).toHaveLength(1)
    expect(user.id).toBe("user_new")
    // Secrets never leave the server (toPublic strips them).
    expect(user).not.toHaveProperty("password")
    expect(user).not.toHaveProperty("totpSecret")
  })

  it("creates only the user when no membership is requested", async () => {
    sqlMock.queueResults([insertedUser])

    await createUser(input)

    expect(userInserts()).toHaveLength(1)
    expect(membershipInserts()).toHaveLength(0)
  })

  it("propagates a failed membership insert so the transaction rolls back", async () => {
    // Simulate the FK backstop firing (household deleted concurrently): the
    // membership insert rejects and createUser must rethrow rather than
    // swallow it — sql.begin translates the throw into a ROLLBACK, so no
    // half-provisioned account survives.
    sqlMock.queueResults([insertedUser])
    sqlMock.failNextMatching(/INSERT INTO "HouseholdMember"/i)

    await expect(
      createUser(input, { householdId: "household_gone", role: "MEMBER" })
    ).rejects.toThrow("foreign key")
  })
})
