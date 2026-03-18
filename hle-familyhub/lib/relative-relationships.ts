import prisma from "./prisma";
import type { Relationship } from "@prisma/client";

/**
 * For a given household + current user, finds the viewer's FamilyMember record
 * (via linkedUserId), then queries all FamilyRelation rows where
 * toMemberId = selfMemberId.
 *
 * Each row's fromMemberId → relationType tells us
 * "that person IS [relationType] TO me."
 *
 * Returns Map<memberId, Relationship> for all connected members.
 */
export async function getRelativeRelationships(
  householdId: string,
  currentUserId: string,
  allHouseholdIds?: string[],
): Promise<Map<string, Relationship>> {
  const effectiveHouseholdIds = allHouseholdIds ?? [householdId];

  const selfMember = await prisma.familyMember.findFirst({
    where: {
      householdId: { in: effectiveHouseholdIds },
      linkedUserId: currentUserId,
    },
    select: { id: true },
  });

  if (!selfMember) return new Map();

  const relations = await prisma.familyRelation.findMany({
    where: {
      householdId: { in: effectiveHouseholdIds },
      toMemberId: selfMember.id,
    },
    select: {
      fromMemberId: true,
      relationType: true,
    },
  });

  const map = new Map<string, Relationship>();
  for (const r of relations) {
    map.set(r.fromMemberId, r.relationType);
  }

  return map;
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
  relativeMap: Map<string, Relationship>,
): Relationship | null {
  return relativeMap.get(memberId) ?? staticRelationship ?? null;
}
