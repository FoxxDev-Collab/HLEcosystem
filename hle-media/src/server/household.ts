import { sql } from "./db";

export const HOUSEHOLD_COOKIE = "mv_household_id";

export type Household = {
  id: string;
  name: string;
};

export async function getHouseholdsForUser(userId: string): Promise<Household[]> {
  return (await sql`
    SELECT h."id", h."name"
    FROM family_manager."Household" h
    JOIN family_manager."HouseholdMember" hm ON h."id" = hm."householdId"
    WHERE hm."userId" = ${userId}
    ORDER BY h."name"
  `) as Household[];
}

export async function userBelongsToHousehold(
  userId: string,
  householdId: string,
): Promise<boolean> {
  const rows = (await sql`
    SELECT 1 AS ok
    FROM family_manager."HouseholdMember"
    WHERE "userId" = ${userId} AND "householdId" = ${householdId}
    LIMIT 1
  `) as { ok: number }[];
  return rows.length > 0;
}
