"use server";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { suggestMeals } from "@/lib/claude-api";
import { getRecipes } from "@/lib/mealie";

export type MealSuggestion = {
  recipeName: string;
  reasoning: string;
  missingIngredients: string[];
  difficulty: string;
  estimatedTime: string;
  mealieSlug: string | null;
};

export type UseItUpResult = {
  suggestions: MealSuggestion[];
} | {
  error: string;
};

export async function suggestRecipesForExpiringAction(
  ingredients: string[]
): Promise<UseItUpResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household" };

  const preferences = "Focus on using these ingredients before they expire. Suggest simple, practical meals.";
  const result = await suggestMeals(ingredients, preferences, 5);

  if (!result.success || !result.data) {
    return { error: result.error ?? "Failed to get suggestions" };
  }

  // Try to cross-reference with Mealie recipes
  const suggestions: MealSuggestion[] = [];

  for (const s of result.data.suggestions) {
    let mealieSlug: string | null = null;

    try {
      // Search Mealie for a matching recipe
      const search = await getRecipes(householdId, 1, 5, s.recipeName);
      const match = search.items.find(
        (r) => r.name.toLowerCase().includes(s.recipeName.toLowerCase()) ||
               s.recipeName.toLowerCase().includes(r.name.toLowerCase())
      );
      if (match) mealieSlug = match.slug;
    } catch {
      // Mealie search failed, skip
    }

    suggestions.push({
      ...s,
      mealieSlug,
    });
  }

  return { suggestions };
}
