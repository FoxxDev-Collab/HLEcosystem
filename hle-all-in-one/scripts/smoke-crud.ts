// End-to-end smoke of the raw-SQL data layer the admin user-CRUD + household
// flows are built on. Runs against the live PG18. Idempotent-ish: cleans up
// the test user at the end.
import { sql } from "../src/server/db"
import {
  createUser,
  deleteUser,
  getUserWithSecretByEmail,
  listUsers,
  setUserPassword,
  updateUser,
  verifyPassword,
} from "../src/server/users"
import {
  addExistingUserByEmail,
  listHouseholdsForUser,
  listMembers,
  removeMember,
} from "../src/server/households"

const EMAIL = "crud-smoke@hle.local"
let pass = 0
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`)
  if (ok) pass++
  else throw new Error(`FAILED: ${label}`)
}

async function main() {
  // Clean any leftover from a prior run.
  await sql`DELETE FROM "User" WHERE "email" = ${EMAIL}`

  // CREATE
  const created = await createUser({
    email: EMAIL,
    firstName: "CRUD",
    lastName: "Smoke",
    password: "initial-pw-123",
    role: "MEMBER",
  })
  check(
    "createUser returns public shape (no password field)",
    !("password" in created)
  )
  check("createUser derives display name", created.name === "CRUD Smoke")

  // READ (list)
  const all = await listUsers()
  check(
    "listUsers includes new user",
    all.some((u) => u.email === EMAIL)
  )

  // Password verify
  const withSecret = await getUserWithSecretByEmail(EMAIL)
  check(
    "verifyPassword true for correct pw",
    await verifyPassword(withSecret!, "initial-pw-123")
  )
  check(
    "verifyPassword false for wrong pw",
    !(await verifyPassword(withSecret!, "nope"))
  )

  // UPDATE (promote + deactivate)
  const updated = await updateUser(created.id, {
    firstName: "CRUD",
    lastName: "Smoke2",
    email: EMAIL,
    role: "ADMIN",
    active: false,
  })
  check(
    "updateUser applied role+name+active",
    updated.role === "ADMIN" &&
      updated.lastName === "Smoke2" &&
      updated.active === false
  )

  // SET PASSWORD
  await setUserPassword(created.id, "rotated-pw-456")
  const after = await getUserWithSecretByEmail(EMAIL)
  check(
    "setUserPassword rotates hash",
    await verifyPassword(after!, "rotated-pw-456")
  )

  // Household membership: add the test user to the admin's household.
  const admin = await getUserWithSecretByEmail("admin@hle.local")
  const adminHouseholds = await listHouseholdsForUser(admin!.id)
  check("admin has a household", adminHouseholds.length > 0)
  const hid = adminHouseholds[0].id

  const addRes = await addExistingUserByEmail(hid, EMAIL, "MEMBER")
  check("addExistingUserByEmail ok", addRes.ok === true)

  const members = await listMembers(hid)
  const memberRow = members.find((m) => m.email === EMAIL)
  check("listMembers includes added user", Boolean(memberRow))

  await removeMember(hid, memberRow!.membershipId)
  const membersAfter = await listMembers(hid)
  check(
    "removeMember removed the user",
    !membersAfter.some((m) => m.email === EMAIL)
  )

  // DELETE — the test user owns no household, so the last-owner guard in
  // deleteUser must not refuse.
  const deleted = await deleteUser(created.id)
  check("deleteUser returned ok", "ok" in deleted)
  const gone = await getUserWithSecretByEmail(EMAIL)
  check("deleteUser removed the account", gone === null)

  console.log(`\nAll ${pass} CRUD checks passed against PG18.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
