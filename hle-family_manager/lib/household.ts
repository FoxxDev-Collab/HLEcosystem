import { cookies } from "next/headers";
import { prisma } from "./prisma";

const HOUSEHOLD_COOKIE = "fm_household_id";

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
  return prisma.household.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getHouseholdById(id: string): Promise<Household | null> {
  return prisma.household.findUnique({ where: { id } });
}
