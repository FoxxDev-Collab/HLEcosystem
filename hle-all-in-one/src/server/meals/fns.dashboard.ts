// Meals dashboard fn + the "Use It Up" AI suggestion flow (suggest recipes
// for expiring pantry items, fuzzy-matched against the Mealie recipe cache).
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  countOutOfStockItems,
  getDashboardCounts,
  listActiveListsWithProgress,
  listExpiringItems,
  listLowStockItems,
  listRecentPrices,
} from "./dashboard"
import { getMealieConfig, getRecipes, getTodaysMealPlan } from "./mealie"
import type { MealieMealPlanEntry } from "./mealie"
import { isAiConfigured, suggestMeals } from "./claude-api"

export const getMealsDashboardFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [
      counts,
      recentPrices,
      activeLists,
      lowStock,
      outOfStockCount,
      expiring,
      mealieConfig,
      todaysMeals,
    ] = await Promise.all([
      getDashboardCounts(context.householdId),
      listRecentPrices(context.householdId),
      listActiveListsWithProgress(context.householdId),
      listLowStockItems(context.householdId),
      countOutOfStockItems(context.householdId),
      listExpiringItems(context.householdId),
      getMealieConfig(context.householdId),
      getTodaysMealPlan(context.householdId).catch(
        () => [] as Array<MealieMealPlanEntry>
      ),
    ])

    return {
      counts,
      recentPrices,
      activeLists,
      lowStock,
      outOfStockCount,
      expiring,
      mealieConnected: !!mealieConfig,
      mealieApiUrl: mealieConfig?.apiUrl ?? null,
      todaysMeals,
      aiConfigured: isAiConfigured(),
      userName: context.user.name,
    }
  })

// "Use It Up": AI meal suggestions for expiring ingredients, cross-referenced
// against Mealie (cache-first search) to attach a recipe slug when one of the
// household's recipes matches. Degrades to { error } when AI is unconfigured.
export const suggestRecipesForExpiringFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        ingredients: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    if (!isAiConfigured()) {
      return { error: "AI features not configured" }
    }

    const preferences =
      "Focus on using these ingredients before they expire. Suggest simple, practical meals."
    const result = await suggestMeals(data.ingredients, preferences, 5)
    if (!result.success || !result.data) {
      return { error: result.error ?? "Failed to get suggestions" }
    }

    const suggestions: Array<{
      recipeName: string
      reasoning: string
      missingIngredients: Array<string>
      difficulty: string
      estimatedTime: string
      mealieSlug: string | null
    }> = []

    for (const s of result.data.suggestions) {
      let mealieSlug: string | null = null
      try {
        const search = await getRecipes(context.householdId, 1, 5, s.recipeName)
        const match = search.items.find(
          (r) =>
            r.name.toLowerCase().includes(s.recipeName.toLowerCase()) ||
            s.recipeName.toLowerCase().includes(r.name.toLowerCase())
        )
        if (match) mealieSlug = match.slug
      } catch {
        // Mealie search failed — suggestion still useful without a link.
      }
      suggestions.push({ ...s, mealieSlug })
    }

    return { suggestions }
  })
