import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { getHouseholdMembersWithRelationships } from "./household";

export async function syncHouseholdMembers(householdId: string): Promise<void> {
  const householdMembers = await getHouseholdMembersWithRelationships(householdId);
  if (householdMembers.length === 0) return;

  const existingLinks = await prisma.familyMember.findMany({
    where: { householdId, linkedUserId: { not: null } },
    select: { linkedUserId: true },
  });
  const linkedUserIds = new Set(existingLinks.map((m) => m.linkedUserId!));

  const unlinked = householdMembers.filter((hm) => !linkedUserIds.has(hm.userId));
  if (unlinked.length === 0) return;

  for (const hm of unlinked) {
    const parts = hm.displayName.trim().split(" ");
    const firstName = parts[0] || hm.displayName;
    const lastName = parts.slice(1).join(" ") || "";

    try {
      await prisma.familyMember.create({
        data: {
          householdId,
          linkedUserId: hm.userId,
          firstName,
          lastName,
          relationship: hm.familyRelationship || null,
        },
      });
    } catch (e: unknown) {
      // P2002 = unique constraint violation — another request already created this member
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
  }
}
