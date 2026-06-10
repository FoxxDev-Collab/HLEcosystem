import { sql } from "./db"
import type {
  HouseholdRole,
  HouseholdWithRole,
  MemberWithUser,
} from "@/lib/types"

export async function listHouseholdsForUser(
  userId: string,
): Promise<Array<HouseholdWithRole>> {
  return (await sql`
    SELECT h."id", h."name", hm."role"
    FROM "Household" h
    JOIN "HouseholdMember" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = ${userId}
    ORDER BY h."name" ASC
  `)
}

// The tenancy boundary: does this user actually belong to this household?
export async function getMembership(
  userId: string,
  householdId: string,
): Promise<{ id: string; role: HouseholdRole } | null> {
  const rows = (await sql`
    SELECT "id", "role" FROM "HouseholdMember"
    WHERE "userId" = ${userId} AND "householdId" = ${householdId}
  `)
  return rows[0] ?? null
}

export async function createHousehold(
  name: string,
  userId: string,
  displayName: string,
): Promise<{ id: string; name: string }> {
  return (await sql.begin(async (tx) => {
    const rows = (await tx`
      INSERT INTO "Household" ("name","createdById")
      VALUES (${name}, ${userId})
      RETURNING "id","name"
    `)
    const hh = rows[0]
    await tx`
      INSERT INTO "HouseholdMember" ("householdId","userId","displayName","role")
      VALUES (${hh.id}, ${userId}, ${displayName}, 'OWNER')
    `
    return hh
  }))
}

export async function listMembers(
  householdId: string,
): Promise<Array<MemberWithUser>> {
  return (await sql`
    SELECT hm."id" AS "membershipId", u."id" AS "userId", hm."displayName",
           hm."role", u."email",
           btrim(u."firstName" || ' ' || u."lastName") AS "name", u."active"
    FROM "HouseholdMember" hm
    JOIN "User" u ON u."id" = hm."userId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY hm."role" ASC, u."lastName" ASC, u."firstName" ASC
  `)
}

// Owners add EXISTING users (by email) — they cannot mint new identities.
export async function addExistingUserByEmail(
  householdId: string,
  email: string,
  role: HouseholdRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const users = (await sql`
    SELECT "id", btrim("firstName" || ' ' || "lastName") AS "name"
    FROM "User" WHERE lower("email") = lower(${email})
  `)
  if (users.length === 0) {
    return {
      ok: false,
      error: "No user with that email. An admin must create the account first.",
    }
  }
  const u = users[0]
  const existing = (await sql`
    SELECT 1 FROM "HouseholdMember"
    WHERE "householdId" = ${householdId} AND "userId" = ${u.id} LIMIT 1
  `)
  if (existing.length > 0) {
    return { ok: false, error: "That user is already a member of this household." }
  }
  await sql`
    INSERT INTO "HouseholdMember" ("householdId","userId","displayName","role")
    VALUES (${householdId}, ${u.id}, ${u.name}, ${role}::"HouseholdRole")
  `
  return { ok: true }
}

export async function removeMember(
  householdId: string,
  membershipId: string,
): Promise<void> {
  await sql`
    DELETE FROM "HouseholdMember"
    WHERE "id" = ${membershipId} AND "householdId" = ${householdId}
  `
}
