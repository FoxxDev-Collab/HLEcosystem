import { prisma } from "./prisma";

export type HouseholdMember = {
  id: string;
  displayName: string;
  userName: string;
  email: string;
};

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  return prisma.$queryRaw<HouseholdMember[]>`
    SELECT hm."id", hm."displayName", u."name" AS "userName", u."email"
    FROM family_manager."HouseholdMember" hm
    JOIN family_manager."User" u ON u."id" = hm."userId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY hm."displayName"
  `;
}
