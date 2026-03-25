"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getMealPlan, getRecipe, getMealieConfig, getWeekRange } from "@/lib/mealie";
import { optimizeShoppingList } from "@/lib/claude-api";
import prisma from "@/lib/prisma";
import type { ProductUnit } from "@prisma/client";

export type GeneratedItem = {
  name: string;
  quantity: number | string;
  unit: string | null;
  category: string;
  notes: string | null;
  selected: boolean;
};

export type GenerateResult = {
  items: GeneratedItem[];
  tips: string[];
  recipesUsed: string[];
} | {
  error: string;
};

export async function generateShoppingListAction(): Promise<GenerateResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const config = await getMealieConfig(householdId);
  if (!config) return { error: "Mealie is not connected. Configure it in Settings." };

  // Get this week's meal plan
  const { startDate, endDate } = getWeekRange();
  const mealPlan = await getMealPlan(householdId, startDate, endDate);

  if (mealPlan.length === 0) {
    return { error: "No meals planned for this week. Add recipes to your Mealie meal plan first." };
  }

  // Fetch full recipe details for each planned meal
  const recipeIds = new Set(mealPlan.filter((m) => m.recipeId).map((m) => m.recipeId!));
  const recipes: { name: string; ingredients: string[] }[] = [];
  const recipeNames: string[] = [];

  for (const recipeId of recipeIds) {
    try {
      const recipe = await getRecipe(householdId, recipeId);
      const ingredients = recipe.recipeIngredient
        .map((i) => i.display)
        .filter((d) => d.trim().length > 0);

      recipes.push({ name: recipe.name, ingredients });
      recipeNames.push(recipe.name);
    } catch {
      // Skip recipes that fail to load
    }
  }

  if (recipes.length === 0) {
    return { error: "Could not load recipe details from Mealie." };
  }

  // Get current pantry state
  const pantryItems = await prisma.pantryItem.findMany({
    where: { householdId, quantity: { gt: 0 } },
    include: { product: { select: { name: true } } },
  });

  const pantryData = pantryItems.map((p) => ({
    name: p.product.name,
    quantity: Number(p.quantity),
    unit: p.unit,
  }));

  // Get store names
  const stores = await prisma.store.findMany({
    where: { householdId, isActive: true },
    select: { name: true },
  });

  // Call Claude to optimize
  const result = await optimizeShoppingList(
    recipes,
    pantryData,
    stores.map((s) => s.name)
  );

  if (!result.success || !result.data) {
    return { error: result.error ?? "Failed to generate shopping list" };
  }

  return {
    items: result.data.items.map((item) => ({
      ...item,
      selected: true,
    })),
    tips: result.data.tips,
    recipesUsed: recipeNames,
  };
}

export async function createShoppingListFromAiAction(
  name: string,
  items: { name: string; quantity: number | string; unit: string | null; category: string }[]
): Promise<{ id?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  if (items.length === 0) return { error: "No items selected" };

  // Create the shopping list
  const list = await prisma.shoppingList.create({
    data: {
      householdId,
      name,
      status: "ACTIVE",
    },
  });

  // For each item, find or create a product, then add to list
  for (const item of items) {
    let product = await prisma.product.findFirst({
      where: {
        householdId,
        name: { equals: item.name, mode: "insensitive" },
      },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          householdId,
          name: item.name,
          defaultUnit: "EACH",
        },
      });
    }

    const qty = typeof item.quantity === "string" ? parseFloat(item.quantity) || 1 : item.quantity;

    await prisma.shoppingListItem.create({
      data: {
        listId: list.id,
        productId: product.id,
        quantity: qty,
        unit: item.unit as ProductUnit | null,
      },
    });
  }

  revalidatePath("/shopping-lists");
  revalidatePath("/dashboard");

  return { id: list.id };
}
