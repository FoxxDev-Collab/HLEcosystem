import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { getHouseholdMembersWithRelationships } from "./household";

export async function syncHouseholdMembers(householdId: string): Promise<void> {
  const householdMembers = await getHouseholdMembersWithRelationships(householdId);
  const activeUserIds = new Set(householdMembers.map((hm) => hm.userId));

  // Get all local members linked to a user
  const linkedMembers = await prisma.familyMember.findMany({
    where: { householdId, linkedUserId: { not: null } },
    select: { id: true, linkedUserId: true, isActive: true },
  });

  const linkedUserIds = new Set(linkedMembers.map((m) => m.linkedUserId!));

  // Deactivate members whose linkedUserId is no longer in the household
  // Reactivate members who have returned
  for (const member of linkedMembers) {
    const stillInHousehold = activeUserIds.has(member.linkedUserId!);

    if (!stillInHousehold && member.isActive) {
      await prisma.familyMember.update({
        where: { id: member.id },
        data: { isActive: false },
      });
    } else if (stillInHousehold && !member.isActive) {
      await prisma.familyMember.update({
        where: { id: member.id },
        data: { isActive: true },
      });
    }
  }

  // Create new local members for users not yet linked
  const unlinked = householdMembers.filter((hm) => !linkedUserIds.has(hm.userId));
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
