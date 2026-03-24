"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getMealPlan, getRecipe, parseIngredient } from "@/lib/mealie";
import type { ParsedIngredient } from "@/lib/mealie";

// ── Shared: find or create product, deduplicated ────────────────

async function findOrCreateProduct(
  householdId: string,
  parsed: ParsedIngredient,
  productLookup: Map<string, string>
): Promise<string> {
  // 1. Exact match on normalized key
  let productId = productLookup.get(parsed.normalizedKey);
  if (productId) return productId;

  // 2. Check if any existing product name matches (case-insensitive)
  //    Only match if the shorter name is at least 4 chars (avoid "oil" matching "olive oil")
  if (parsed.normalizedKey.length >= 4) {
    for (const [existingName, existingId] of productLookup) {
      if (existingName.length < 4) continue;
      if (existingName === parsed.normalizedKey) {
        productId = existingId;
        break;
      }
    }
  }
  if (productId) return productId;

  // 3. Create new product
  const newProduct = await prisma.product.create({
    data: {
      householdId,
      name: parsed.productName,
      defaultUnit: "EACH",
    },
  });
  productLookup.set(parsed.normalizedKey, newProduct.id);
  return newProduct.id;
}

// ── Aggregate ingredients across recipes ────────────────────────

function aggregateIngredients(
  allIngredients: ParsedIngredient[]
): Map<string, { parsed: ParsedIngredient; totalQuantity: number; recipeNotes: string[] }> {
  const aggregated = new Map<
    string,
    { parsed: ParsedIngredient; totalQuantity: number; recipeNotes: string[] }
  >();

  for (const parsed of allIngredients) {
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

  return aggregated;
}

// ── Sync full meal plan ─────────────────────────────────────────

export async function syncMealPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const listName = formData.get("listName") as string;
  if (!startDate || !endDate || !listName?.trim()) return;

  // 1. Fetch meal plan from Mealie
  const mealPlan = await getMealPlan(householdId, startDate, endDate);
  const recipeEntries = mealPlan.filter((e) => e.recipeId);
  if (recipeEntries.length === 0) return;

  // 2. Fetch full recipe details — deduplicate by recipeId
  const uniqueRecipeIds = [...new Set(recipeEntries.map((e) => e.recipeId!))];
  const recipes = await Promise.all(
    uniqueRecipeIds.map((id) => getRecipe(householdId, id))
  );

  // Count how many times each recipe appears in the plan
  const recipeCounts = new Map<string, number>();
  for (const entry of recipeEntries) {
    recipeCounts.set(entry.recipeId!, (recipeCounts.get(entry.recipeId!) || 0) + 1);
  }

  // 3. Parse and aggregate all ingredients
  const allIngredients: ParsedIngredient[] = [];
  for (const recipe of recipes) {
    const multiplier = recipeCounts.get(recipe.id) || 1;
    for (const ing of recipe.recipeIngredient) {
      const parsed = parseIngredient(ing);
      if (!parsed) continue;
      // Multiply quantity by how many times this recipe appears
      allIngredients.push({ ...parsed, quantity: parsed.quantity * multiplier });
    }
  }

  const aggregated = aggregateIngredients(allIngredients);

  // 4. Load existing products for matching
  const existingProducts = await prisma.product.findMany({
    where: { householdId },
  });
  const productLookup = new Map<string, string>();
  for (const p of existingProducts) {
    productLookup.set(p.name.toLowerCase(), p.id);
  }

  // 5. Create shopping list
  const list = await prisma.shoppingList.create({
    data: {
      householdId,
      name: listName.trim(),
      status: "DRAFT",
      notes: `Synced from Mealie: ${startDate} to ${endDate} (${recipeEntries.length} meals, ${uniqueRecipeIds.length} unique recipes)`,
    },
  });

  // 6. Create items — sorted alphabetically for a clean list
  const sorted = [...aggregated.entries()].sort((a, b) =>
    a[1].parsed.productName.localeCompare(b[1].parsed.productName)
  );

  let sortOrder = 0;
  for (const [, { parsed, totalQuantity, recipeNotes }] of sorted) {
    const productId = await findOrCreateProduct(householdId, parsed, productLookup);

    await prisma.shoppingListItem.create({
      data: {
        listId: list.id,
        productId,
        quantity: totalQuantity,
        notes: recipeNotes.length <= 2 ? recipeNotes.join("; ") : `${recipeNotes.length} recipes`,
        sortOrder: sortOrder++,
      },
    });
  }

  revalidatePath("/shopping-lists");
  revalidatePath("/mealie");
  revalidatePath("/dashboard");
  revalidatePath("/products");
  redirect(`/shopping-lists/${list.id}`);
}

// ── Sync single recipe ──────────────────────────────────────────

export async function syncSingleRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const recipeId = formData.get("recipeId") as string;
  const recipeName = formData.get("recipeName") as string;
  const listId = formData.get("listId") as string | null;
  if (!recipeId) return;

  const recipe = await getRecipe(householdId, recipeId);

  const existingProducts = await prisma.product.findMany({
    where: { householdId },
  });
  const productLookup = new Map<string, string>();
  for (const p of existingProducts) {
    productLookup.set(p.name.toLowerCase(), p.id);
  }

  // Use existing list or create new one
  let targetListId = listId;
  if (!targetListId) {
    const list = await prisma.shoppingList.create({
      data: {
        householdId,
        name: recipeName || recipe.name,
        status: "DRAFT",
        notes: `Ingredients from: ${recipe.name}`,
      },
    });
    targetListId = list.id;
  } else {
    const list = await prisma.shoppingList.findFirst({
      where: { id: targetListId, householdId },
    });
    if (!list) return;
  }

  // Parse, aggregate (handles duplicate ingredients within a recipe)
  const allIngredients: ParsedIngredient[] = [];
  for (const ing of recipe.recipeIngredient) {
    const parsed = parseIngredient(ing);
    if (parsed) allIngredients.push(parsed);
  }

  const aggregated = aggregateIngredients(allIngredients);
  const sorted = [...aggregated.entries()].sort((a, b) =>
    a[1].parsed.productName.localeCompare(b[1].parsed.productName)
  );

  let sortOrder = 0;
  for (const [, { parsed, totalQuantity }] of sorted) {
    const productId = await findOrCreateProduct(householdId, parsed, productLookup);

    await prisma.shoppingListItem.create({
      data: {
        listId: targetListId,
        productId,
        quantity: totalQuantity,
        notes: parsed.recipeNote,
        sortOrder: sortOrder++,
      },
    });
  }

  revalidatePath("/shopping-lists");
  revalidatePath(`/shopping-lists/${targetListId}`);
  revalidatePath("/mealie");
  revalidatePath("/products");
  redirect(`/shopping-lists/${targetListId}`);
}
