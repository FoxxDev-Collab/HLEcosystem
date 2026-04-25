"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { testMealieConnection, getMealieConfig, mealieFetch, getWeekRange } from "@/lib/mealie";
import {
  upsertCachedRecipes,
  upsertCachedMealPlan,
  markRecipesSynced,
} from "@/lib/mealie-cache";
import type { MealieRecipeSummary, MealieMealPlanEntry } from "@/lib/mealie";

export async function saveMealieConfigAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const apiUrl = (formData.get("apiUrl") as string)?.trim().replace(/\/+$/, "");
  const apiToken = (formData.get("apiToken") as string)?.trim();

  if (!apiUrl || !apiToken) return;

  // Test the connection before saving
  const result = await testMealieConnection(apiUrl, apiToken);
  if (!result.ok) {
    // We can't easily return errors from server actions without a client component,
    // but the config won't be saved if the connection fails.
    // For now, still save but mark as inactive if test fails.
  }

  await prisma.mealieConfig.upsert({
    where: { householdId },
    create: {
      householdId,
      apiUrl,
      apiToken,
      isActive: result.ok,
    },
    update: {
      apiUrl,
      apiToken,
      isActive: result.ok,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/mealie");
  revalidatePath("/dashboard");
}

export async function testMealieConfigAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const apiUrl = (formData.get("apiUrl") as string)?.trim().replace(/\/+$/, "");
  const apiToken = (formData.get("apiToken") as string)?.trim();

  if (!apiUrl || !apiToken) return;

  const result = await testMealieConnection(apiUrl, apiToken);

  // Redirect back with test result as query param
  const status = result.ok ? "ok" : encodeURIComponent(result.error || "Connection failed");
  redirect(`/settings?mealie_test=${status}`);
}

export async function disconnectMealieAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  await prisma.mealieConfig.deleteMany({
    where: { householdId },
  });

  revalidatePath("/settings");
  revalidatePath("/mealie");
  revalidatePath("/dashboard");
}

export async function syncNowAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const config = await getMealieConfig(householdId);
  if (!config) return;

  let totalSynced = 0;
  try {
    let page = 1;
    while (true) {
      const data = await mealieFetch<{ items: MealieRecipeSummary[]; total_pages: number }>(
        config,
        `/api/recipes?page=${page}&perPage=50&orderBy=name&orderDirection=asc`
      );
      if (data.items.length > 0) {
        await upsertCachedRecipes(householdId, data.items);
        totalSynced += data.items.length;
      }
      if (page >= data.total_pages || data.items.length < 50) break;
      page++;
    }
    await markRecipesSynced(householdId, totalSynced);

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
  } catch {
    // Partial sync is fine — whatever succeeded is cached
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/mealie");
  revalidatePath("/recipes");
}
