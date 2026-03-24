import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import {
  getMealPlan,
  getMealieConfig,
  getRecipe,
  parseIngredient,
} from "@/lib/mealie";
import type { ParsedIngredient } from "@/lib/mealie";
import { SyncReviewForm } from "./sync-review-form";

export type ReviewItem = {
  key: string;
  recipeNote: string;
  proposedName: string;
  normalizedKey: string;
  quantity: number;
  unit: string | null;
  matchedProductId: string | null;
  matchedProductName: string | null;
  pantryQty: number;
};

export type ExistingProduct = {
  id: string;
  name: string;
};

export type ExistingList = {
  id: string;
  name: string;
  status: string;
  itemCount: number;
};

export default async function SyncReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    listName?: string;
    recipeId?: string;
    recipeName?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const config = await getMealieConfig(householdId);
  if (!config) redirect("/settings");

  const params = await searchParams;
  const { startDate, endDate, listName, recipeId, recipeName } = params;

  const isMealPlanSync = !!(startDate && endDate);
  const isRecipeSync = !!recipeId;

  if (!isMealPlanSync && !isRecipeSync) redirect("/mealie");

  // Fetch ingredients from Mealie
  const allParsed: ParsedIngredient[] = [];
  let sourceLabel = "";

  if (isMealPlanSync) {
    const mealPlan = await getMealPlan(householdId, startDate!, endDate!);
    const recipeEntries = mealPlan.filter((e) => e.recipeId);
    if (recipeEntries.length === 0) redirect("/mealie");

    const uniqueRecipeIds = [...new Set(recipeEntries.map((e) => e.recipeId!))];
    const recipes = await Promise.all(
      uniqueRecipeIds.map((id) => getRecipe(householdId, id))
    );

    const recipeCounts = new Map<string, number>();
    for (const entry of recipeEntries) {
      recipeCounts.set(entry.recipeId!, (recipeCounts.get(entry.recipeId!) || 0) + 1);
    }

    for (const recipe of recipes) {
      const multiplier = recipeCounts.get(recipe.id) || 1;
      for (const ing of recipe.recipeIngredient) {
        const parsed = parseIngredient(ing);
        if (!parsed) continue;
        allParsed.push({ ...parsed, quantity: parsed.quantity * multiplier });
      }
    }

    sourceLabel = `Meal Plan: ${startDate} to ${endDate} (${recipeEntries.length} meals)`;
  } else {
    const recipe = await getRecipe(householdId, recipeId!);
    for (const ing of recipe.recipeIngredient) {
      const parsed = parseIngredient(ing);
      if (parsed) allParsed.push(parsed);
    }
    sourceLabel = `Recipe: ${recipeName || recipe.name}`;
  }

  // Aggregate duplicates
  const aggregated = new Map<
    string,
    { parsed: ParsedIngredient; totalQuantity: number; recipeNotes: string[] }
  >();
  for (const parsed of allParsed) {
    const existing = aggregated.get(parsed.normalizedKey);
    if (existing) {
      existing.totalQuantity += parsed.quantity;
      if (!existing.recipeNotes.includes(parsed.recipeNote)) {
        existing.recipeNotes.push(parsed.recipeNote);
      }
    } else {
      aggregated.set(parsed.normalizedKey, {
        parsed,
        totalQuantity: parsed.quantity,
        recipeNotes: [parsed.recipeNote],
      });
    }
  }

  // Load existing products, shopping lists, and pantry
  const [existingProducts, existingLists, pantryItems] = await Promise.all([
    prisma.product.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
    prisma.shoppingList.findMany({
      where: { householdId, status: { in: ["DRAFT", "ACTIVE"] } },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.pantryItem.findMany({
      where: { householdId },
    }),
  ]);

  // Build pantry lookup: productId -> quantity
  const pantryMap = new Map<string, number>();
  for (const p of pantryItems) {
    pantryMap.set(p.productId, Number(p.quantity));
  }
  const productLookup = new Map<string, string>();
  for (const p of existingProducts) {
    productLookup.set(p.name.toLowerCase(), p.id);
  }

  // Build review items
  const reviewItems: ReviewItem[] = [];
  const sorted = [...aggregated.entries()].sort((a, b) =>
    a[1].parsed.productName.localeCompare(b[1].parsed.productName)
  );

  for (const [key, { parsed, totalQuantity, recipeNotes }] of sorted) {
    // Try exact match
    let matchedId = productLookup.get(parsed.normalizedKey) || null;
    let matchedName: string | null = null;

    // If exact match found, get the display name
    if (matchedId) {
      matchedName = existingProducts.find((p) => p.id === matchedId)?.name || null;
    }

    // Check pantry for matched products
    const pantryQty = matchedId ? (pantryMap.get(matchedId) || 0) : 0;

    reviewItems.push({
      key,
      recipeNote: recipeNotes.join("; "),
      proposedName: parsed.productName,
      normalizedKey: parsed.normalizedKey,
      quantity: totalQuantity,
      unit: parsed.unit,
      matchedProductId: matchedId,
      matchedProductName: matchedName,
      pantryQty,
    });
  }

  const defaultListName = listName || recipeName || "Shopping List";

  return (
    <SyncReviewForm
      items={reviewItems}
      existingProducts={existingProducts.map((p) => ({ id: p.id, name: p.name }))}
      existingLists={existingLists.map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        itemCount: l._count.items,
      }))}
      defaultListName={defaultListName}
      sourceLabel={sourceLabel}
      startDate={startDate || null}
      endDate={endDate || null}
      recipeId={recipeId || null}
    />
  );
}
