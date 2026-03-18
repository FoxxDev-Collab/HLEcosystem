import { cookies } from "next/headers";
import { prisma } from "./prisma";

export type Household = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

const COOKIE_NAME = "fh_household_id";

export async function getCurrentHouseholdId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function setCurrentHousehold(householdId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, householdId, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES === "true",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function getHouseholdsForUser(userId: string): Promise<Household[]> {
  return prisma.$queryRaw<Household[]>`
    SELECT h."id", h."name", h."createdAt", h."updatedAt"
    FROM family_manager."Household" h
    JOIN family_manager."HouseholdMember" hm ON h."id" = hm."householdId"
    WHERE hm."userId" = ${userId}
    ORDER BY h."name"
  `;
}

export async function getHouseholdById(id: string): Promise<Household | null> {
  const rows = await prisma.$queryRaw<Household[]>`
    SELECT "id", "name", "createdAt", "updatedAt"
    FROM family_manager."Household"
    WHERE "id" = ${id}
  `;
  return rows[0] ?? null;
}

export type HouseholdMemberWithRelationship = {
  id: string;
  householdId: string;
  userId: string;
  displayName: string;
  role: string;
  familyRelationship: string | null;
  joinedAt: Date;
  userName: string;
  userEmail: string;
};

export async function getHouseholdMembersWithRelationships(
  householdId: string,
): Promise<HouseholdMemberWithRelationship[]> {
  return prisma.$queryRaw<HouseholdMemberWithRelationship[]>`
    SELECT
      hm."id", hm."householdId", hm."userId", hm."displayName",
      hm."role", hm."familyRelationship", hm."joinedAt",
      u."name" AS "userName", u."email" AS "userEmail"
    FROM family_manager."HouseholdMember" hm
    JOIN family_manager."User" u ON u."id" = hm."userId"
    WHERE hm."householdId" = ${householdId}
    ORDER BY hm."joinedAt"
  `;
}
