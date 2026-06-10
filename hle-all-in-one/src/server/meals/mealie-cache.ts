// DB-backed cache for the Mealie integration (per household).
// Cache policy (ported from hle-meal_prep/lib/mealie-cache.ts):
// - recipe summaries: 30-min stale threshold; stale data still serves as a
//   fallback when Mealie is unreachable
// - meal plans: 15-min hard TTL — callers re-fetch when stale
// - recipe detail: cached until the next refetch (no TTL)
import { sql } from "@/server/db"
import type {
  MealieMealPlanEntry,
  MealieRecipe,
  MealieRecipeSummary,
} from "./mealie"

const RECIPE_STALE_MS = 30 * 60 * 1000
const PLAN_TTL_MS = 15 * 60 * 1000

function ageMs(date: Date): number {
  return Date.now() - date.getTime()
}

// ── Sync state ──────────────────────────────────────────

export type MealieSyncStateRow = {
  householdId: string
  recipesSyncedAt: Date | null
  planSyncedAt: Date | null
  recipeTotalCount: number
}

export async function getSyncState(
  householdId: string
): Promise<MealieSyncStateRow | null> {
  const rows = await sql<Array<MealieSyncStateRow>>`
    SELECT "householdId", "recipesSyncedAt", "planSyncedAt", "recipeTotalCount"
    FROM "MealieSyncState"
    WHERE "householdId" = ${householdId}`
  return rows[0] ?? null
}

export async function isRecipeSyncNeeded(
  householdId: string
): Promise<boolean> {
  const state = await getSyncState(householdId)
  if (!state?.recipesSyncedAt) return true
  return ageMs(state.recipesSyncedAt) > RECIPE_STALE_MS
}

export async function markRecipesSynced(
  householdId: string,
  totalCount: number
): Promise<void> {
  await sql`
    INSERT INTO "MealieSyncState"
      ("householdId", "recipesSyncedAt", "recipeTotalCount")
    VALUES (${householdId}, now(), ${totalCount})
    ON CONFLICT ("householdId") DO UPDATE
    SET "recipesSyncedAt" = now(),
        "recipeTotalCount" = ${totalCount},
        "updatedAt" = now()`
}

// ── Recipe cache ────────────────────────────────────────

export async function getCachedRecipes(
  householdId: string,
  search?: string
): Promise<{ recipes: Array<MealieRecipeSummary>; stale: boolean } | null> {
  const state = await getSyncState(householdId)
  if (!state?.recipesSyncedAt) return null

  const stale = ageMs(state.recipesSyncedAt) > RECIPE_STALE_MS

  const rows = search
    ? await sql<Array<{ summaryData: MealieRecipeSummary }>>`
        SELECT "summaryData" FROM "CachedMealieRecipe"
        WHERE "householdId" = ${householdId}
          AND "name" ILIKE ${"%" + search + "%"}
        ORDER BY "name" ASC`
    : await sql<Array<{ summaryData: MealieRecipeSummary }>>`
        SELECT "summaryData" FROM "CachedMealieRecipe"
        WHERE "householdId" = ${householdId}
        ORDER BY "name" ASC`

  if (rows.length === 0 && !search) return null

  return { recipes: rows.map((r) => r.summaryData), stale }
}

// Looks up by slug OR by the Mealie recipe id, so callers holding either key
// (meal-plan entries carry ids, recipe pages carry slugs) hit the cache.
export async function getCachedRecipeDetail(
  householdId: string,
  slugOrId: string
): Promise<MealieRecipe | null> {
  const rows = await sql<Array<{ detailData: MealieRecipe | null }>>`
    SELECT "detailData" FROM "CachedMealieRecipe"
    WHERE "householdId" = ${householdId}
      AND ("slug" = ${slugOrId} OR "mealieRecipeId"::text = ${slugOrId})`
  return rows[0]?.detailData ?? null
}

export async function upsertCachedRecipes(
  householdId: string,
  recipes: Array<MealieRecipeSummary>
): Promise<void> {
  for (const recipe of recipes) {
    await sql`
      INSERT INTO "CachedMealieRecipe"
        ("householdId", "mealieRecipeId", "slug", "name", "summaryData")
      VALUES (${householdId}, ${recipe.id}, ${recipe.slug}, ${recipe.name},
              ${JSON.stringify(recipe)}::jsonb)
      ON CONFLICT ("householdId", "mealieRecipeId") DO UPDATE
      SET "slug" = ${recipe.slug},
          "name" = ${recipe.name},
          "summaryData" = ${JSON.stringify(recipe)}::jsonb,
          "updatedAt" = now()`
  }
}

export async function upsertCachedRecipeDetail(
  householdId: string,
  recipe: MealieRecipe
): Promise<void> {
  await sql`
    INSERT INTO "CachedMealieRecipe"
      ("householdId", "mealieRecipeId", "slug", "name", "summaryData",
       "detailData", "detailCachedAt")
    VALUES (${householdId}, ${recipe.id}, ${recipe.slug}, ${recipe.name},
            ${JSON.stringify(recipe)}::jsonb, ${JSON.stringify(recipe)}::jsonb,
            now())
    ON CONFLICT ("householdId", "mealieRecipeId") DO UPDATE
    SET "slug" = ${recipe.slug},
        "name" = ${recipe.name},
        "detailData" = ${JSON.stringify(recipe)}::jsonb,
        "detailCachedAt" = now(),
        "updatedAt" = now()`
}

// ── Meal plan cache ─────────────────────────────────────

export async function getCachedMealPlan(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<Array<MealieMealPlanEntry> | null> {
  const state = await getSyncState(householdId)
  // Hard TTL — return null when stale so the caller re-fetches from Mealie.
  if (!state?.planSyncedAt || ageMs(state.planSyncedAt) > PLAN_TTL_MS) {
    return null
  }

  const rows = await sql<Array<{ data: MealieMealPlanEntry }>>`
    SELECT "data" FROM "CachedMealieMealPlan"
    WHERE "householdId" = ${householdId}
      AND "date" >= ${startDate} AND "date" <= ${endDate}
    ORDER BY "date" ASC`
  return rows.map((r) => r.data)
}

// Stale-serve fallback used when Mealie is unreachable (ignores the TTL).
export async function getStaleCachedMealPlan(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<Array<MealieMealPlanEntry>> {
  const rows = await sql<Array<{ data: MealieMealPlanEntry }>>`
    SELECT "data" FROM "CachedMealieMealPlan"
    WHERE "householdId" = ${householdId}
      AND "date" >= ${startDate} AND "date" <= ${endDate}
    ORDER BY "date" ASC`
  return rows.map((r) => r.data)
}

export async function upsertCachedMealPlan(
  householdId: string,
  entries: Array<MealieMealPlanEntry>
): Promise<void> {
  for (const entry of entries) {
    await sql`
      INSERT INTO "CachedMealieMealPlan" ("householdId", "entryId", "date", "data")
      VALUES (${householdId}, ${entry.id}, ${entry.date},
              ${JSON.stringify(entry)}::jsonb)
      ON CONFLICT ("householdId", "entryId") DO UPDATE
      SET "date" = ${entry.date},
          "data" = ${JSON.stringify(entry)}::jsonb,
          "updatedAt" = now()`
  }
  await sql`
    INSERT INTO "MealieSyncState" ("householdId", "planSyncedAt")
    VALUES (${householdId}, now())
    ON CONFLICT ("householdId") DO UPDATE
    SET "planSyncedAt" = now(), "updatedAt" = now()`
}
