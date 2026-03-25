import { prisma } from "./prisma";

export type FamilyHubMember = {
  id: string;
  householdId: string;
  linkedUserId: string | null;
  firstName: string;
  lastName: string;
  birthday: Date | null;
  relationship: string | null;
  isActive: boolean;
};

export async function getFamilyHubMembers(householdId: string): Promise<FamilyHubMember[]> {
  return prisma.$queryRaw<FamilyHubMember[]>`
    SELECT "id", "householdId", "linkedUserId", "firstName", "lastName",
           "birthday", "relationship", "isActive"
    FROM familyhub."FamilyMember"
    WHERE "householdId" = ${householdId} AND "isActive" = true
    ORDER BY "firstName", "lastName"
  `;
}

export async function getFamilyHubMemberById(id: string, householdId: string): Promise<FamilyHubMember | null> {
  const rows = await prisma.$queryRaw<FamilyHubMember[]>`
    SELECT "id", "householdId", "linkedUserId", "firstName", "lastName",
           "birthday", "relationship", "isActive"
    FROM familyhub."FamilyMember"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
  `;
  return rows[0] ?? null;
}
