import { sql } from "@/server/db"

// Read-only aggregates for the hub dashboard. Tables owned by other hub
// features (gifts, gift ideas, todos, media requests) are only COUNTed /
// listed here — all writes live with their owning feature.

export type GiftStatus = "IDEA" | "PURCHASED" | "WRAPPED" | "GIVEN"

export type RecentGiftRow = {
  id: string
  description: string
  occasion: string | null
  status: GiftStatus
  memberFirstName: string
  memberLastName: string
}

export type SpouseRow = {
  id: string
  firstName: string
  lastName: string
}

async function countOne(rows: Array<{ count: number }>): Promise<number> {
  return rows[0]?.count ?? 0
}

export async function getActiveMemberCount(
  householdId: string
): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "FamilyMember"
      WHERE "householdId" = ${householdId} AND "isActive" = true
    `
  )
}

export async function getActiveGiftIdeaCount(
  householdId: string
): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "GiftIdea"
      WHERE "householdId" = ${householdId} AND "status" = 'ACTIVE'
    `
  )
}

export async function getGiftsGivenCount(householdId: string): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "Gift"
      WHERE "householdId" = ${householdId} AND "status" = 'GIVEN'
    `
  )
}

export async function getTodoListCount(householdId: string): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "TodoList"
      WHERE "householdId" = ${householdId}
    `
  )
}

// Media requests are cross-household by design (see migrations/0003_hub.sql),
// so this count is intentionally unscoped — same as the legacy dashboard.
export async function getPendingMediaRequestCount(): Promise<number> {
  return countOne(
    await sql`
      SELECT count(*)::int AS "count" FROM "MediaRequest"
      WHERE "status" = 'REQUESTED'
    `
  )
}

export async function listRecentGifts(
  householdId: string
): Promise<Array<RecentGiftRow>> {
  return await sql`
    SELECT g."id", g."description", g."occasion", g."status",
           fm."firstName" AS "memberFirstName", fm."lastName" AS "memberLastName"
    FROM "Gift" g
    JOIN "FamilyMember" fm ON fm."id" = g."familyMemberId"
    WHERE g."householdId" = ${householdId}
    ORDER BY g."updatedAt" DESC
    LIMIT 5
  `
}

export async function getHouseholdName(
  householdId: string
): Promise<string | null> {
  const rows = await sql`
    SELECT "name" FROM "Household" WHERE "id" = ${householdId}
  `
  return rows[0]?.name ?? null
}

// The legacy app read a `familyRelationship` column on the manager's
// HouseholdMember table, which doesn't exist here. Adapted: walk from the
// FamilyMember profile linked to the current user through a Spouse
// FamilyRelation edge.
export async function findSpouseMember(
  householdId: string,
  userId: string
): Promise<SpouseRow | null> {
  const rows = await sql`
    SELECT sm."id", sm."firstName", sm."lastName"
    FROM "FamilyMember" me
    JOIN "FamilyRelation" fr
      ON fr."householdId" = ${householdId}
     AND fr."relationType" = 'Spouse'
     AND (fr."fromMemberId" = me."id" OR fr."toMemberId" = me."id")
    JOIN "FamilyMember" sm
      ON sm."id" = CASE
        WHEN fr."fromMemberId" = me."id" THEN fr."toMemberId"
        ELSE fr."fromMemberId"
      END
    WHERE me."householdId" = ${householdId}
      AND me."linkedUserId" = ${userId}
      AND sm."isActive" = true
    LIMIT 1
  `
  return rows[0] ?? null
}
