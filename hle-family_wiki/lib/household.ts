import { cookies } from "next/headers";
import { prisma } from "./prisma";

const HOUSEHOLD_COOKIE = "wiki_household_id";

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

export async function getAllHouseholds(): Promise<Household[]> {
  return prisma.$queryRaw<Household[]>`
    SELECT "id", "name", "createdAt", "updatedAt"
    FROM family_manager."Household"
    ORDER BY "name"
  `;
}
