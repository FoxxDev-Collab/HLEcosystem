"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ProductUnit } from "@prisma/client";

type MergeItem = {
  id: string;
  display: string;
  foodName: string;
  quantity: number;
  unitName: string | null;
  note: string;
  labelName: string | null;
};

// Map common Mealie unit names to our ProductUnit enum
const UNIT_MAP: Record<string, ProductUnit> = {
  each: "EACH",
  lb: "LB",
  lbs: "LB",
  pound: "LB",
  pounds: "LB",
  oz: "OZ",
  ounce: "OZ",
  ounces: "OZ",
  gallon: "GALLON",
  gallons: "GALLON",
  quart: "QUART",
  quarts: "QUART",
  liter: "LITER",
  liters: "LITER",
  count: "COUNT",
  pack: "PACK",
  packs: "PACK",
  bag: "BAG",
  bags: "BAG",
  box: "BOX",
  boxes: "BOX",
  can: "CAN",
  cans: "CAN",
  bottle: "BOTTLE",
  bottles: "BOTTLE",
  bunch: "BUNCH",
  bunches: "BUNCH",
  dozen: "DOZEN",
  cup: "EACH",
  cups: "EACH",
  tablespoon: "EACH",
  tablespoons: "EACH",
  teaspoon: "EACH",
  teaspoons: "EACH",
  tbsp: "EACH",
  tsp: "EACH",
};

function mapUnit(unitName: string | null): ProductUnit {
  if (!unitName) return "EACH";
  return UNIT_MAP[unitName.toLowerCase().trim()] ?? "EACH";
}

/** Simple title-case cleanup for product names */
function cleanName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

async function findOrCreateProduct(
  householdId: string,
  name: string,
  unitName: string | null,
  labelName: string | null,
  cache: Map<string, string>
): Promise<string> {
  const displayName = cleanName(name);
  const key = displayName.toLowerCase();

  if (cache.has(key)) return cache.get(key)!;

  // Look for existing product
  const existing = await prisma.product.findFirst({
    where: {
      householdId,
      name: { equals: displayName, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true },
  });

  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  // Find or create category from Mealie label
  let categoryId: string | undefined;
  if (labelName) {
    const cat = await prisma.category.findFirst({
      where: {
        householdId,
        name: { equals: labelName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (cat) {
      categoryId = cat.id;
    } else {
      const newCat = await prisma.category.create({
        data: { householdId, name: labelName },
      });
      categoryId = newCat.id;
    }
  }

  // Create product
  const product = await prisma.product.create({
    data: {
      householdId,
      name: displayName,
      defaultUnit: mapUnit(unitName),
      categoryId,
    },
  });

  cache.set(key, product.id);
  return product.id;
}

export async function mergeToShoppingListAction(
  formData: FormData
): Promise<{ listId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const mode = formData.get("mode") as string;
  const itemsJson = formData.get("items") as string;

  if (!itemsJson) return { error: "No items provided" };

  let items: MergeItem[];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Invalid items data" };
  }

  if (items.length === 0) return { error: "No items selected" };

  const productCache = new Map<string, string>();
  let listId: string;

  if (mode === "new") {
    const newListName = (formData.get("newListName") as string)?.trim();
    if (!newListName) return { error: "List name is required" };

    const list = await prisma.shoppingList.create({
      data: {
        householdId,
        name: newListName,
        status: "DRAFT",
      },
    });
    listId = list.id;
  } else {
    const targetListId = formData.get("targetListId") as string;
    if (!targetListId) return { error: "Target list is required" };

    const existing = await prisma.shoppingList.findFirst({
      where: { id: targetListId, householdId },
    });
    if (!existing) return { error: "Shopping list not found" };
    listId = existing.id;
  }

  // Process each item: find/create product, add to list
  for (const item of items) {
    const productId = await findOrCreateProduct(
      householdId,
      item.foodName,
      item.unitName,
      item.labelName,
      productCache
    );

    // Check if product already on list
    const existingItem = await prisma.shoppingListItem.findFirst({
      where: { listId, productId },
    });

    if (existingItem) {
      // Increment quantity
      await prisma.shoppingListItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: { increment: item.quantity || 1 },
          notes: item.note
            ? existingItem.notes
              ? `${existingItem.notes}; ${item.note}`
              : item.note
            : existingItem.notes,
        },
      });
    } else {
      await prisma.shoppingListItem.create({
        data: {
          listId,
          productId,
          quantity: item.quantity || 1,
          unit: mapUnit(item.unitName),
          notes: item.note || null,
        },
      });
    }
  }

  revalidatePath("/shopping-lists");
  revalidatePath(`/shopping-lists/${listId}`);
  revalidatePath("/mealie/shopping-lists");

  return { listId };
}
