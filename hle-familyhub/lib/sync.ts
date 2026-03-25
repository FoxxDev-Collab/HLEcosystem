import prisma from "./prisma";
import { getHouseholdMembersWithRelationships } from "./household";

/**
 * Deactivate FamilyMember records whose linkedUserId is no longer
 * present in family_manager.HouseholdMember for this household.
 * Also reactivate members who have returned to the household.
 */
export async function syncFamilyMembers(householdId: string): Promise<void> {
  const householdMembers = await getHouseholdMembersWithRelationships(householdId);
  const activeUserIds = new Set(householdMembers.map((hm) => hm.userId));

  // Find all linked FamilyMember records for this household
  const linkedMembers = await prisma.familyMember.findMany({
    where: { householdId, linkedUserId: { not: null } },
    select: { id: true, linkedUserId: true, isActive: true },
  });

  for (const member of linkedMembers) {
    const stillInHousehold = activeUserIds.has(member.linkedUserId!);

    if (!stillInHousehold && member.isActive) {
      // User was removed from household — deactivate
      await prisma.familyMember.update({
        where: { id: member.id },
        data: { isActive: false },
      });
    } else if (stillInHousehold && !member.isActive) {
      // User was re-added to household — reactivate
      await prisma.familyMember.update({
        where: { id: member.id },
        data: { isActive: true },
      });
    }
  }
}
