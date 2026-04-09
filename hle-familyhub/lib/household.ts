import { cookies } from "next/headers";
import { prisma } from "./prisma";

const HOUSEHOLD_COOKIE = "fhub_household_id";

export type Household = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getCurrentHouseholdId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(HOUSEHOLD_COOKIE)?.value ?? null;
}

export async function setCurrentHousehold(householdId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES !== "false" && process.env.NODE_ENV === "production",
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

// FamilyHub-specific extensions below

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
  householdId: string
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

export type SpouseInfo = {
  userId: string;
  displayName: string;
  email: string;
};

export async function getSpouseForUser(
  householdId: string,
  currentUserId: string,
): Promise<SpouseInfo | null> {
  const rows = await prisma.$queryRaw<SpouseInfo[]>`
    SELECT hm."userId", hm."displayName", u."email"
    FROM family_manager."HouseholdMember" hm
    JOIN family_manager."User" u ON u."id" = hm."userId"
    WHERE hm."householdId" = ${householdId}
      AND hm."userId" != ${currentUserId}
      AND hm."familyRelationship" = 'Spouse'
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getAllHouseholds(): Promise<Household[]> {
  return prisma.$queryRaw<Household[]>`
    SELECT "id", "name", "createdAt", "updatedAt"
    FROM family_manager."Household"
    ORDER BY "name"
  `;
}
