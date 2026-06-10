// FamilyRelation query layer — ported from hle-familyhub family-tree actions.
//
// Intentional change from legacy: the legacy app let relations span households
// (cross-household tree discovery). This port is strictly household-scoped per
// PORTING.md invariant 2 — every query filters on householdId and both member
// ids are re-verified against the household before any insert.

import { sql } from "@/server/db"
import { getInverseRelation } from "@/lib/hub/relationships"
import type { Relationship } from "@/lib/hub/relationships"

export type TreeMemberRow = {
  id: string
  firstName: string
  lastName: string
  relationship: Relationship | null
  birthday: string | null // DATE ::text → "YYYY-MM-DD"
  linkedUserId: string | null
}

export type FamilyRelationRow = {
  id: string
  fromMemberId: string
  toMemberId: string
  relationType: Relationship
}

export type RelationWithMembersRow = FamilyRelationRow & {
  fromFirstName: string
  fromLastName: string
  toFirstName: string
  toLastName: string
  createdAt: Date
}

export async function listTreeMembers(
  householdId: string
): Promise<Array<TreeMemberRow>> {
  return sql<Array<TreeMemberRow>>`
    SELECT "id", "firstName", "lastName", "relationship",
           "birthday"::text, "linkedUserId"
    FROM "FamilyMember"
    WHERE "householdId" = ${householdId} AND "isActive" = true
    ORDER BY "firstName"`
}

export async function listRelations(
  householdId: string
): Promise<Array<FamilyRelationRow>> {
  return sql<Array<FamilyRelationRow>>`
    SELECT "id", "fromMemberId", "toMemberId", "relationType"
    FROM "FamilyRelation"
    WHERE "householdId" = ${householdId}`
}

export async function listRelationsWithMembers(
  householdId: string
): Promise<Array<RelationWithMembersRow>> {
  return sql<Array<RelationWithMembersRow>>`
    SELECT r."id", r."fromMemberId", r."toMemberId", r."relationType",
           r."createdAt",
           f."firstName" AS "fromFirstName", f."lastName" AS "fromLastName",
           t."firstName" AS "toFirstName", t."lastName" AS "toLastName"
    FROM "FamilyRelation" r
    JOIN "FamilyMember" f ON f."id" = r."fromMemberId"
    JOIN "FamilyMember" t ON t."id" = r."toMemberId"
    WHERE r."householdId" = ${householdId}
    ORDER BY r."createdAt" DESC`
}

// The viewer's own FamilyMember record (linked via linkedUserId), used to
// compute viewer-relative relationship labels for the tree.
export async function findSelfMemberId(
  householdId: string,
  userId: string
): Promise<string | null> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FamilyMember"
    WHERE "householdId" = ${householdId} AND "linkedUserId" = ${userId}
    LIMIT 1`
  return rows[0]?.id ?? null
}

// Creates both directions (A→B and the inverse B→A) in one transaction —
// legacy behavior: adding "Parent" also creates "Child" the other way.
export async function createRelationPair(
  householdId: string,
  fromMemberId: string,
  toMemberId: string,
  relationType: Relationship
): Promise<{ ok: true } | { error: string }> {
  // PORTING.md invariant 2: never trust ids from the client — both members
  // must belong to this household.
  const members = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FamilyMember"
    WHERE "householdId" = ${householdId}
      AND "id" IN (${fromMemberId}, ${toMemberId})`
  if (members.length < 2) {
    return { error: "Both people must belong to your household." }
  }

  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FamilyRelation"
    WHERE "householdId" = ${householdId}
      AND (("fromMemberId" = ${fromMemberId} AND "toMemberId" = ${toMemberId})
        OR ("fromMemberId" = ${toMemberId} AND "toMemberId" = ${fromMemberId}))
    LIMIT 1`
  if (existing.length > 0) {
    return {
      error:
        "Those two people are already connected. Remove the existing connection first.",
    }
  }

  const inverseType = getInverseRelation(relationType)
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO "FamilyRelation"
        ("householdId", "fromMemberId", "toMemberId", "relationType")
      VALUES (${householdId}, ${fromMemberId}, ${toMemberId},
              ${relationType}::"Relationship")`
    await tx`
      INSERT INTO "FamilyRelation"
        ("householdId", "fromMemberId", "toMemberId", "relationType")
      VALUES (${householdId}, ${toMemberId}, ${fromMemberId},
              ${inverseType}::"Relationship")`
  })
  return { ok: true }
}

// Deletes the relation and its inverse (both directions of the pair).
export async function deleteRelationPair(
  householdId: string,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const rows = await sql<Array<{ fromMemberId: string; toMemberId: string }>>`
    SELECT "fromMemberId", "toMemberId" FROM "FamilyRelation"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  const relation = rows[0]
  if (!relation) {
    return { error: "Connection not found." }
  }

  await sql`
    DELETE FROM "FamilyRelation"
    WHERE "householdId" = ${householdId}
      AND (("fromMemberId" = ${relation.fromMemberId} AND "toMemberId" = ${relation.toMemberId})
        OR ("fromMemberId" = ${relation.toMemberId} AND "toMemberId" = ${relation.fromMemberId}))`
  return { ok: true }
}
