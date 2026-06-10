// Ported from hle-familyhub/lib/relative-relationships.ts.
//
// The legacy module queried FamilyRelation rows itself (Prisma). Here the
// query layer (src/server/hub/relations.ts) loads the household's relations
// once, and this module derives the viewer-relative map from those rows —
// same semantics, no second query.

import type { Relationship } from "./relationships"

export type RelationLike = {
  fromMemberId: string
  toMemberId: string
  relationType: Relationship
}

/**
 * Given the viewer's FamilyMember id (matched via linkedUserId) and the
 * household's FamilyRelation rows, returns memberId → Relationship for every
 * connected member: each row with toMemberId = selfMemberId means
 * "that person IS [relationType] TO me."
 */
export function buildRelativeRelationships(
  selfMemberId: string | null,
  relations: Array<RelationLike>
): Record<string, Relationship> {
  const map: Record<string, Relationship> = {}
  if (!selfMemberId) return map
  for (const r of relations) {
    if (r.toMemberId === selfMemberId) {
      map[r.fromMemberId] = r.relationType
    }
  }
  return map
}

/**
 * Returns the best display label for a member:
 * 1. Relative map entry (viewer-relative from FamilyRelation) — authoritative
 * 2. Static FamilyMember.relationship field — legacy fallback
 * 3. null — no relationship known
 */
export function getDisplayRelationship(
  memberId: string,
  staticRelationship: Relationship | null,
  relativeMap: Record<string, Relationship>
): Relationship | null {
  return relativeMap[memberId] ?? staticRelationship ?? null
}
