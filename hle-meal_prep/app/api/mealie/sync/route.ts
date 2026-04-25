import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getMealieConfig, mealieFetch, getWeekRange } from "@/lib/mealie";
import {
  isRecipeSyncNeeded,
  upsertCachedRecipes,
  upsertCachedMealPlan,
  markRecipesSynced,
} from "@/lib/mealie-cache";
import type { MealieRecipeSummary, MealieMealPlanEntry } from "@/lib/mealie";

const RECIPES_PER_PAGE = 50;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 400 });

  const config = await getMealieConfig(householdId);
  if (!config) return NextResponse.json({ skipped: true, reason: "no_config" });

  const syncNeeded = await isRecipeSyncNeeded(householdId);
  if (!syncNeeded) return NextResponse.json({ skipped: true, reason: "fresh" });

  let totalSynced = 0;

  try {
    // ── Sync all recipes ─────────────────────────────────────────────────────
    let page = 1;
    while (true) {
      const data = await mealieFetch<{
        items: MealieRecipeSummary[];
        total: number;
        total_pages: number;
      }>(config, `/api/recipes?page=${page}&perPage=${RECIPES_PER_PAGE}&orderBy=name&orderDirection=asc`);

      if (data.items.length > 0) {
        await upsertCachedRecipes(householdId, data.items);
        totalSynced += data.items.length;
      }

      if (page >= data.total_pages || data.items.length < RECIPES_PER_PAGE) break;
      page++;
    }

    await markRecipesSynced(householdId, totalSynced);

    // ── Sync current week + next week's meal plan ────────────────────────────
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { startDate } = getWeekRange(now);
    const { endDate } = getWeekRange(nextWeek);

    const planData = await mealieFetch<MealieMealPlanEntry[] | { items: MealieMealPlanEntry[] }>(
      config,
      `/api/households/mealplans?start_date=${startDate}&end_date=${endDate}`
    );
    const entries = Array.isArray(planData) ? planData : planData.items;
    await upsertCachedMealPlan(householdId, entries);

    return NextResponse.json({ synced: true, recipes: totalSynced, planEntries: entries.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 502 }
    );
  }
}
