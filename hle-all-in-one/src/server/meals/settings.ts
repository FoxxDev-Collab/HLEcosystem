// "MealieConfig" CRUD. The apiToken NEVER leaves the server — UI-facing
// queries return a masked status row only.
import { sql } from "@/server/db"

// Safe to send to the client: no token, just whether one is stored.
export type MealieConfigStatus = {
  apiUrl: string
  isActive: boolean
  hasToken: boolean
  updatedAt: Date
}

export async function getMealieConfigStatus(
  householdId: string
): Promise<MealieConfigStatus | null> {
  const rows = await sql<Array<MealieConfigStatus>>`
    SELECT "apiUrl", "isActive",
           ("apiToken" <> '') AS "hasToken", "updatedAt"
    FROM "MealieConfig"
    WHERE "householdId" = ${householdId}`
  return rows[0] ?? null
}

// Server-side only — includes the token (used to re-test a saved connection).
export async function getStoredMealieCredentials(
  householdId: string
): Promise<{ apiUrl: string; apiToken: string } | null> {
  const rows = await sql<Array<{ apiUrl: string; apiToken: string }>>`
    SELECT "apiUrl", "apiToken" FROM "MealieConfig"
    WHERE "householdId" = ${householdId}`
  return rows[0] ?? null
}

export async function upsertMealieConfig(
  householdId: string,
  apiUrl: string,
  apiToken: string,
  isActive: boolean
): Promise<void> {
  await sql`
    INSERT INTO "MealieConfig" ("householdId", "apiUrl", "apiToken", "isActive")
    VALUES (${householdId}, ${apiUrl}, ${apiToken}, ${isActive})
    ON CONFLICT ("householdId") DO UPDATE
    SET "apiUrl" = ${apiUrl},
        "apiToken" = ${apiToken},
        "isActive" = ${isActive},
        "updatedAt" = now()`
}

export async function deleteMealieConfig(householdId: string): Promise<void> {
  await sql`DELETE FROM "MealieConfig" WHERE "householdId" = ${householdId}`
}
