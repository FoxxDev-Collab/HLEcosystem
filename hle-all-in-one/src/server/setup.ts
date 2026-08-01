// First-run instance setup: creates the initial ADMIN plus their household.
// Only ever valid while the User table is empty — the INSERT itself carries
// the emptiness guard, and the whole thing runs behind an advisory lock so
// two concurrent submissions cannot both pass a read-then-write check under
// READ COMMITTED. See docs/adr/0006-first-run-setup-wizard.md (repo root).
import { sql } from "./db"

export async function isSetupNeeded(): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM "User" LIMIT 1`
  return rows.length === 0
}

const SETUP_LOCK_KEY = 0x484c4501 // "HLE" + 01, arbitrary but stable

export async function createFirstAdmin(data: {
  email: string
  firstName: string
  lastName: string
  passwordHash: string
  householdName: string
}): Promise<{ userId: string; householdId: string } | null> {
  const displayName = `${data.firstName} ${data.lastName}`.trim()
  return await sql.begin(async (tx) => {
    // Serialize concurrent setup attempts: the second waits here until the
    // first commits, then its NOT EXISTS sees the new admin and inserts
    // nothing. Released automatically at transaction end.
    await tx`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`
    const users = await tx`
      INSERT INTO "User" ("email","firstName","lastName","password","role","active")
      SELECT ${data.email}, ${data.firstName}, ${data.lastName},
             ${data.passwordHash}, 'ADMIN', true
      WHERE NOT EXISTS (SELECT 1 FROM "User")
      RETURNING "id"
    `
    if (users.length === 0) return null
    const userId = users[0].id as string
    const households = await tx`
      INSERT INTO "Household" ("name","createdById")
      VALUES (${data.householdName}, ${userId})
      RETURNING "id"
    `
    const householdId = households[0].id as string
    await tx`
      INSERT INTO "HouseholdMember" ("householdId","userId","displayName","role")
      VALUES (${householdId}, ${userId}, ${displayName}, 'OWNER')
    `
    return { userId, householdId }
  })
}
