import prisma from "./prisma";
import type { MealieRecipeSummary, MealieRecipe, MealieMealPlanEntry } from "./mealie";

const RECIPE_STALE_MS = 30 * 60 * 1000;  // 30 min — trigger background refresh
const PLAN_TTL_MS     = 15 * 60 * 1000;  // 15 min — hard refresh for meal plans

function ageMs(date: Date): number {
  return Date.now() - date.getTime();
}

// ── Sync state ───────────────────────────────────────────────────────────────

export async function getSyncState(householdId: string) {
  return prisma.mealieSyncState.findUnique({ where: { householdId } });
}

export async function isRecipeSyncNeeded(householdId: string): Promise<boolean> {
  const state = await prisma.mealieSyncState.findUnique({
    where: { householdId },
    select: { recipesSyncedAt: true },
  });
  if (!state?.recipesSyncedAt) return true;
  return ageMs(state.recipesSyncedAt) > RECIPE_STALE_MS;
}

// ── Recipe cache ─────────────────────────────────────────────────────────────

export async function getCachedRecipes(
  householdId: string,
  search?: string
): Promise<{ recipes: MealieRecipeSummary[]; stale: boolean } | null> {
  const state = await prisma.mealieSyncState.findUnique({
    where: { householdId },
    select: { recipesSyncedAt: true },
  });
  if (!state?.recipesSyncedAt) return null;

  const stale = ageMs(state.recipesSyncedAt) > RECIPE_STALE_MS;

  const where = search
    ? { householdId, name: { contains: search, mode: "insensitive" as const } }
    : { householdId };

  const rows = await prisma.cachedMealieRecipe.findMany({
    where,
    orderBy: { name: "asc" },
    select: { summaryData: true },
  });

  if (rows.length === 0 && !search) return null;

  return {
    recipes: rows.map((r) => r.summaryData as MealieRecipeSummary),
    stale,
  };
}

export async function getCachedRecipeDetail(
  householdId: string,
  slug: string
): Promise<MealieRecipe | null> {
  const row = await prisma.cachedMealieRecipe.findUnique({
    where: { householdId_slug: { householdId, slug } },
    select: { detailData: true, detailCachedAt: true },
  });
  if (!row?.detailData) return null;
  return row.detailData as MealieRecipe;
}

export async function upsertCachedRecipes(
  householdId: string,
  recipes: MealieRecipeSummary[]
): Promise<void> {
  if (recipes.length === 0) return;

  await Promise.all(
    recipes.map((recipe) =>
      prisma.cachedMealieRecipe.upsert({
        where: { householdId_slug: { householdId, slug: recipe.slug } },
        create: {
          id: recipe.id,
          householdId,
          slug: recipe.slug,
          name: recipe.name,
          summaryData: recipe as object,
        },
        update: {
          name: recipe.name,
          summaryData: recipe as object,
          updatedAt: new Date(),
        },
      })
    )
  );
}

export async function upsertCachedRecipeDetail(
  householdId: string,
  recipe: MealieRecipe
): Promise<void> {
  await prisma.cachedMealieRecipe.upsert({
    where: { householdId_slug: { householdId, slug: recipe.slug } },
    create: {
      id: recipe.id,
      householdId,
      slug: recipe.slug,
      name: recipe.name,
      summaryData: recipe as object,
      detailData: recipe as object,
      detailCachedAt: new Date(),
    },
    update: {
      detailData: recipe as object,
      detailCachedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function markRecipesSynced(
  householdId: string,
  totalCount: number
): Promise<void> {
  await prisma.mealieSyncState.upsert({
    where: { householdId },
    create: { householdId, recipesSyncedAt: new Date(), recipeTotalCount: totalCount },
    update: { recipesSyncedAt: new Date(), recipeTotalCount: totalCount },
  });
}

// ── Meal plan cache ──────────────────────────────────────────────────────────

export async function getCachedMealPlan(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<MealieMealPlanEntry[] | null> {
  const state = await prisma.mealieSyncState.findUnique({
    where: { householdId },
    select: { planSyncedAt: true },
  });
  // Hard TTL for meal plans — return null if stale so caller re-fetches
  if (!state?.planSyncedAt || ageMs(state.planSyncedAt) > PLAN_TTL_MS) return null;

  const rows = await prisma.cachedMealieMealPlan.findMany({
    where: { householdId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: "asc" },
    select: { data: true },
  });

  return rows.map((r) => r.data as MealieMealPlanEntry);
}

export async function upsertCachedMealPlan(
  householdId: string,
  entries: MealieMealPlanEntry[]
): Promise<void> {
  if (entries.length === 0) {
    await prisma.mealieSyncState.upsert({
      where: { householdId },
      create: { householdId, planSyncedAt: new Date() },
      update: { planSyncedAt: new Date() },
    });
    return;
  }

  await Promise.all([
    ...entries.map((entry) =>
      prisma.cachedMealieMealPlan.upsert({
        where: { householdId_entryId: { householdId, entryId: entry.id } },
        create: { householdId, entryId: entry.id, date: entry.date, data: entry as object },
        update: { date: entry.date, data: entry as object, updatedAt: new Date() },
      })
    ),
    prisma.mealieSyncState.upsert({
      where: { householdId },
      create: { householdId, planSyncedAt: new Date() },
      update: { planSyncedAt: new Date() },
    }),
  ]);
}
