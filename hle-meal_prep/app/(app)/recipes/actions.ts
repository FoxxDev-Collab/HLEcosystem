"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getRecipe, parseIngredient } from "@/lib/mealie";
import type { ParsedIngredient } from "@/lib/mealie";

async function findOrCreateProduct(
  householdId: string,
  parsed: ParsedIngredient,
  productLookup: Map<string, string>
): Promise<string> {
  let productId = productLookup.get(parsed.normalizedKey);
  if (productId) return productId;

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

export async function importIngredientsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const recipeSlug = formData.get("recipeSlug") as string;
  if (!recipeSlug) return;

  const recipe = await getRecipe(householdId, recipeSlug);

  const existingProducts = await prisma.product.findMany({
    where: { householdId },
  });
  const productLookup = new Map<string, string>();
  for (const p of existingProducts) {
    productLookup.set(p.name.toLowerCase(), p.id);
  }

  for (const ing of recipe.recipeIngredient) {
    const parsed = parseIngredient(ing);
    if (!parsed) continue;
    await findOrCreateProduct(householdId, parsed, productLookup);
  }

  revalidatePath("/products");
  revalidatePath(`/recipes/${recipeSlug}`);
  redirect(`/recipes/${recipeSlug}`);
}

export async function addRecipeToListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const recipeSlug = formData.get("recipeSlug") as string;
  const listId = formData.get("listId") as string | null;
  if (!recipeSlug) return;

  const recipe = await getRecipe(householdId, recipeSlug);

  const existingProducts = await prisma.product.findMany({
    where: { householdId },
  });
  const productLookup = new Map<string, string>();
  for (const p of existingProducts) {
    productLookup.set(p.name.toLowerCase(), p.id);
  }

  let targetListId = listId;
  if (!targetListId) {
    const list = await prisma.shoppingList.create({
      data: {
        householdId,
        name: recipe.name,
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

  // Parse and deduplicate ingredients within this recipe
  const seen = new Map<string, { parsed: ParsedIngredient; totalQty: number }>();
  for (const ing of recipe.recipeIngredient) {
    const parsed = parseIngredient(ing);
    if (!parsed) continue;
    const existing = seen.get(parsed.normalizedKey);
    if (existing) {
      existing.totalQty += parsed.quantity;
    } else {
      seen.set(parsed.normalizedKey, { parsed, totalQty: parsed.quantity });
    }
  }

  const sorted = [...seen.entries()].sort((a, b) =>
    a[1].parsed.productName.localeCompare(b[1].parsed.productName)
  );

  let sortOrder = 0;
  for (const [, { parsed, totalQty }] of sorted) {
    const productId = await findOrCreateProduct(householdId, parsed, productLookup);

    await prisma.shoppingListItem.create({
      data: {
        listId: targetListId,
        productId,
        quantity: totalQty,
        notes: parsed.recipeNote,
        sortOrder: sortOrder++,
      },
    });
  }

  revalidatePath("/shopping-lists");
  revalidatePath(`/shopping-lists/${targetListId}`);
  revalidatePath("/products");
  revalidatePath(`/recipes/${recipeSlug}`);
  redirect(`/shopping-lists/${targetListId}`);
}

export async function toggleFavoriteRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const mealieRecipeId = formData.get("mealieRecipeId") as string;
  const mealieSlug = formData.get("mealieSlug") as string;
  const recipeName = formData.get("recipeName") as string;
  if (!mealieRecipeId || !mealieSlug || !recipeName) return;

  const existing = await prisma.favoriteRecipe.findFirst({
    where: { householdId, mealieRecipeId },
  });

  if (existing) {
    await prisma.favoriteRecipe.delete({ where: { id: existing.id } });
  } else {
    await prisma.favoriteRecipe.create({
      data: { householdId, mealieRecipeId, mealieSlug, recipeName },
    });
  }

  revalidatePath("/recipes");
  revalidatePath("/recipes/" + mealieSlug);
}
