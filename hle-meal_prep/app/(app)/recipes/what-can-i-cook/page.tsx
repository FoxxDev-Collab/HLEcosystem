import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import {
  getMealieConfig,
  getRecipes,
  getRecipe,
  getRecipeImageUrl,
  normalizeIngredientName,
} from "@/lib/mealie";
import type { MealieRecipe } from "@/lib/mealie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  UtensilsCrossed,
  Clock,
  Users,
  ArrowRight,
  Package,
  Settings,
} from "lucide-react";

type RecipeMatch = {
  recipe: MealieRecipe;
  matchedIngredients: string[];
  missingIngredients: string[];
  matchPercent: number;
};

export default async function WhatCanICookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const mealieConfig = await getMealieConfig(householdId);

  if (!mealieConfig) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="size-6" />
            What Can I Cook?
          </h1>
          <p className="text-muted-foreground">
            Find recipes based on what you already have
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">Mealie Not Connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Mealie instance in Settings to match recipes with your pantry.
            </p>
            <Link href="/settings">
              <Button className="gap-2">
                <Settings className="size-4" />
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get pantry items with product names
  const pantryItems = await prisma.pantryItem.findMany({
    where: { householdId, quantity: { gt: 0 } },
    include: { product: true },
  });

  if (pantryItems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="size-6" />
            What Can I Cook?
          </h1>
          <p className="text-muted-foreground">
            Find recipes based on what you already have
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">Pantry is Empty</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add items to your pantry first, then come back to find recipes you can make.
            </p>
            <Link href="/pantry">
              <Button className="gap-2">
                <Package className="size-4" />
                Go to Pantry
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build pantry name set for matching
  const pantryNames = new Set(
    pantryItems.map((p) => p.product.name.toLowerCase())
  );

  // Fetch recipes from Mealie
  const recipeSummaries = await getRecipes(householdId, 1, 30);

  // Fetch full details in parallel (need ingredients)
  const recipeResults = await Promise.allSettled(
    recipeSummaries.items.map((r) => getRecipe(householdId, r.slug))
  );

  const fullRecipes = recipeResults
    .filter((r): r is PromiseFulfilledResult<MealieRecipe> => r.status === "fulfilled")
    .map((r) => r.value);

  // Match each recipe against pantry
  const matches: RecipeMatch[] = [];

  for (const recipe of fullRecipes) {
    if (recipe.recipeIngredient.length === 0) continue;

    const matched: string[] = [];
    const missing: string[] = [];

    for (const ing of recipe.recipeIngredient) {
      const name = normalizeIngredientName(ing);
      if (!name || name.length < 2) continue;

      let found = pantryNames.has(name);
      if (!found) {
        for (const pantryName of pantryNames) {
          if (pantryName.includes(name) || name.includes(pantryName)) {
            found = true;
            break;
          }
        }
      }

      const displayName = ing.food?.name || ing.display || name;
      if (found) {
        matched.push(displayName);
      } else {
        missing.push(displayName);
      }
    }

    const total = matched.length + missing.length;
    if (total === 0) continue;

    matches.push({
      recipe,
      matchedIngredients: matched,
      missingIngredients: missing,
      matchPercent: Math.round((matched.length / total) * 100),
    });
  }

  // Sort by match percentage descending, then by fewer missing items
  matches.sort((a, b) => {
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    return a.missingIngredients.length - b.missingIngredients.length;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UtensilsCrossed className="size-6" />
          What Can I Cook?
        </h1>
        <p className="text-muted-foreground">
          {pantryItems.length} pantry items matched against {fullRecipes.length} recipes
        </p>
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">No Matching Recipes</h3>
            <p className="text-sm text-muted-foreground">
              None of your Mealie recipes matched your current pantry items.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {matches.map((match) => (
            <Card key={match.recipe.slug} className="overflow-hidden">
              <div className="flex gap-0">
                {/* Recipe image */}
                <div className="hidden sm:block w-40 shrink-0">
                  <img
                    src={getRecipeImageUrl(mealieConfig.apiUrl, match.recipe.id)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{match.recipe.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {match.recipe.totalTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {match.recipe.totalTime}
                          </span>
                        )}
                        {match.recipe.recipeServings && (
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {match.recipe.recipeServings} servings
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/recipes/${match.recipe.slug}`}>
                      <Button variant="outline" size="sm" className="gap-1 shrink-0">
                        View <ArrowRight className="size-3" />
                      </Button>
                    </Link>
                  </div>

                  {/* Match progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {match.matchedIngredients.length} of{" "}
                        {match.matchedIngredients.length + match.missingIngredients.length} ingredients
                      </span>
                      <span
                        className={
                          match.matchPercent >= 80
                            ? "font-semibold text-green-600"
                            : match.matchPercent >= 50
                              ? "font-semibold text-yellow-600"
                              : "text-muted-foreground"
                        }
                      >
                        {match.matchPercent}%
                      </span>
                    </div>
                    <Progress
                      value={match.matchPercent}
                      className="h-2"
                    />
                  </div>

                  {/* Missing ingredients */}
                  {match.missingIngredients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground">Missing:</span>
                      {match.missingIngredients.slice(0, 5).map((ing) => (
                        <Badge key={ing} variant="outline" className="text-xs py-0">
                          {ing}
                        </Badge>
                      ))}
                      {match.missingIngredients.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{match.missingIngredients.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
