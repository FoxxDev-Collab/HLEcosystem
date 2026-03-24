import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import {
  getMealieConfig,
  getRecipe,
  getRecipeImageUrl,
  getMealieRecipeUrl,
  normalizeIngredientName,
} from "@/lib/mealie";
import type { MealieIngredient } from "@/lib/mealie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Clock,
  Timer,
  Users,
  ExternalLink,
  ShoppingCart,
  Download,
  Check,
  Plus,
} from "lucide-react";
import { importIngredientsAction } from "../actions";

function formatIngredientDisplay(ing: MealieIngredient): string {
  const parts: string[] = [];
  if (ing.quantity) parts.push(String(ing.quantity));
  if (ing.unit?.name) parts.push(ing.unit.name);
  if (ing.food?.name) parts.push(ing.food.name);
  if (parts.length > 0) {
    if (ing.note) parts.push(`(${ing.note})`);
    return parts.join(" ");
  }
  return ing.display || ing.note;
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { slug } = await params;
  const mealieConfig = await getMealieConfig(householdId);
  if (!mealieConfig) redirect("/recipes");

  let recipe;
  try {
    recipe = await getRecipe(householdId, slug);
  } catch {
    redirect("/recipes");
  }

  // Load existing products to check matches
  const existingProducts = await prisma.product.findMany({
    where: { householdId },
  });
  const productLookup = new Map<string, string>();
  for (const p of existingProducts) {
    productLookup.set(p.name.toLowerCase(), p.id);
  }

  // Determine which ingredients match existing products
  const ingredientMatches = recipe.recipeIngredient.map((ing) => {
    const name = normalizeIngredientName(ing);
    if (!name || name.length < 2) return { ingredient: ing, matched: false, skipped: true };

    let matched = productLookup.has(name);
    if (!matched) {
      for (const existingName of productLookup.keys()) {
        if (existingName.includes(name) || name.includes(existingName)) {
          matched = true;
          break;
        }
      }
    }
    return { ingredient: ing, matched, skipped: false };
  });

  const matchedCount = ingredientMatches.filter((m) => m.matched).length;
  const newCount = ingredientMatches.filter((m) => !m.matched && !m.skipped).length;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/recipes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Recipes
      </Link>

      {/* Header */}
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
          <Image
            src={getRecipeImageUrl(mealieConfig.apiUrl, recipe.id)}
            alt={recipe.name}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 1024px) 100vw, 33vw"
          />
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{recipe.name}</h1>
            {recipe.description && (
              <p className="text-muted-foreground mt-1">{recipe.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {recipe.totalTime && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-4" />
                <span>Total: {recipe.totalTime}</span>
              </div>
            )}
            {recipe.prepTime && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="size-4" />
                <span>Prep: {recipe.prepTime}</span>
              </div>
            )}
            {recipe.performTime && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="size-4" />
                <span>Cook: {recipe.performTime}</span>
              </div>
            )}
            {recipe.recipeServings && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-4" />
                <span>{recipe.recipeServings} servings</span>
              </div>
            )}
          </div>

          {/* Categories and tags */}
          <div className="flex flex-wrap gap-2">
            {recipe.recipeCategory?.map((cat) => (
              <Badge key={cat.slug} variant="secondary">
                {cat.name}
              </Badge>
            ))}
            {recipe.tags?.map((tag) => (
              <Badge key={tag.slug} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/mealie/sync-review?recipeId=${recipe.id}&recipeName=${encodeURIComponent(recipe.name)}`}>
              <Button className="gap-2">
                <ShoppingCart className="size-4" />
                Add to Shopping List
              </Button>
            </Link>
            <form action={importIngredientsAction}>
              <input type="hidden" name="recipeSlug" value={recipe.slug} />
              <Button type="submit" variant="outline" className="gap-2">
                <Download className="size-4" />
                Import All as Products
              </Button>
            </form>
            <a
              href={getMealieRecipeUrl(mealieConfig.apiUrl, recipe.slug)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" className="gap-2">
                <ExternalLink className="size-4" />
                View in Mealie
              </Button>
            </a>
          </div>

          {recipe.orgURL && (
            <a
              href={recipe.orgURL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              Original source
            </a>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ingredients ({recipe.recipeIngredient.length})</span>
            <span className="text-sm font-normal text-muted-foreground">
              {matchedCount} matched, {newCount} new
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recipe.recipeIngredient.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No ingredients listed for this recipe.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Status</TableHead>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredientMatches.map((match, idx) => {
                  const ing = match.ingredient;
                  return (
                    <TableRow key={ing.referenceId || idx}>
                      <TableCell>
                        {match.skipped ? (
                          <span className="text-muted-foreground">-</span>
                        ) : match.matched ? (
                          <Check className="size-4 text-green-600" />
                        ) : (
                          <Plus className="size-4 text-blue-600" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {ing.food?.name || ing.display}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ing.quantity ?? "\u2014"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ing.unit?.name ?? "\u2014"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {ing.note || "\u2014"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
