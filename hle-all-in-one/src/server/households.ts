import { sql } from "./db"
import type {
  HouseholdRole,
  HouseholdWithRole,
  MemberWithUser,
} from "@/lib/types"

export async function listHouseholdsForUser(
  userId: string
): Promise<Array<HouseholdWithRole>> {
  return await sql`
    SELECT h."id", h."name", hm."role"
    FROM "Household" h
    JOIN "HouseholdMember" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = ${userId}
    ORDER BY h."name" ASC
  `
}

// Admin-only (instance scope): every household, for the user-provisioning
// dropdown. Never expose through a non-admin fn — regular users only see
// their own memberships via listHouseholdsForUser.
export async function listAllHouseholds(): Promise<
  Array<{ id: string; name: string; memberCount: number }>
> {
  return await sql`
    SELECT h."id", h."name", count(hm."id")::int AS "memberCount"
    FROM "Household" h
    LEFT JOIN "HouseholdMember" hm ON hm."householdId" = h."id"
    GROUP BY h."id", h."name"
    ORDER BY h."name" ASC
  `
}

// The tenancy boundary: does this user actually belong to this household?
export async function getMembership(
  userId: string,
  householdId: string
): Promise<{ id: string; role: HouseholdRole } | null> {
  const rows = await sql`
    SELECT "id", "role" FROM "HouseholdMember"
    WHERE "userId" = ${userId} AND "householdId" = ${householdId}
  `
  return rows[0] ?? null
}

export async function createHousehold(
  name: string,
  userId: string,
  displayName: string
): Promise<{ id: string; name: string }> {
  return await sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO "Household" ("name","createdById")
      VALUES (${name}, ${userId})
      RETURNING "id","name"
    `
    const hh = rows[0]
    await tx`
      INSERT INTO "HouseholdMember" ("householdId","userId","displayName","role")
      VALUES (${hh.id}, ${userId}, ${displayName}, 'OWNER')
    `
    return hh
  })
}

export async function listMembers(
  householdId: string
): Promise<Array<MemberWithUser>> {
  return await sql`
    SELECT hm."id" AS "membershipId", u."id" AS "userId", hm."displayName",
           hm."role", u."email",
           btrim(u."firstName" || ' ' || u."lastName") AS "name", u."active"
    FROM "HouseholdMember" hm
    JOIN "User" u ON u."id" = hm."userId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY hm."role" ASC, u."lastName" ASC, u."firstName" ASC
  `
}

// Owners add EXISTING users (by email) — they cannot mint new identities.
export async function addExistingUserByEmail(
  householdId: string,
  email: string,
  role: HouseholdRole
): Promise<{ ok: true } | { ok: false; error: string }> {
  const users = await sql`
    SELECT "id", btrim("firstName" || ' ' || "lastName") AS "name"
    FROM "User" WHERE lower("email") = lower(${email})
  `
  if (users.length === 0) {
    return {
      ok: false,
      error: "No user with that email. An admin must create the account first.",
    }
  }
  const u = users[0]
  const existing = await sql`
    SELECT 1 FROM "HouseholdMember"
    WHERE "householdId" = ${householdId} AND "userId" = ${u.id} LIMIT 1
  `
  if (existing.length > 0) {
    return {
      ok: false,
      error: "That user is already a member of this household.",
    }
  }
  await sql`
    INSERT INTO "HouseholdMember" ("householdId","userId","displayName","role")
    VALUES (${householdId}, ${u.id}, ${u.name}, ${role}::"HouseholdRole")
  `
  return { ok: true }
}

// Refuses to remove the household's last OWNER (atomically — the EXISTS
// runs inside the DELETE, no read-then-write window): a household left with
// only MEMBERs is permanently unmanageable, since adding or removing members
// requires an OWNER. Add another OWNER first, then remove this one.
export async function removeMember(
  householdId: string,
  membershipId: string
): Promise<{ ok: true } | { error: string }> {
  const removed = await sql<Array<{ id: string }>>`
    DELETE FROM "HouseholdMember" hm
    WHERE hm."id" = ${membershipId} AND hm."householdId" = ${householdId}
      AND (
        hm."role" <> 'OWNER'
        OR EXISTS (
          SELECT 1 FROM "HouseholdMember" o
          WHERE o."householdId" = ${householdId}
            AND o."role" = 'OWNER' AND o."id" <> hm."id"
        )
      )
    RETURNING hm."id"
  `
  if (removed.length > 0) return { ok: true }
  const target = await sql<Array<{ role: string }>>`
    SELECT "role" FROM "HouseholdMember"
    WHERE "id" = ${membershipId} AND "householdId" = ${householdId}
  `
  if (target.length === 0) return { error: "Member not found." }
  return {
    error: "Cannot remove the household's only owner. Add another owner first.",
  }
}
