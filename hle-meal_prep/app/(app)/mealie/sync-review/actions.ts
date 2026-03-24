"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

type CommitItem = {
  productName: string;
  normalizedKey: string;
  quantity: number;
  recipeNote: string;
  existingProductId: string | null;
};

async function findOrCreateProduct(
  householdId: string,
  item: CommitItem,
  createdProducts: Map<string, string>
): Promise<string> {
  if (item.existingProductId) return item.existingProductId;

  // Check batch cache
  const cached = createdProducts.get(item.normalizedKey);
  if (cached) return cached;

  // Check DB for case-insensitive match
  const existing = await prisma.product.findFirst({
    where: {
      householdId,
      name: { equals: item.productName, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    createdProducts.set(item.normalizedKey, existing.id);
    return existing.id;
  }

  // Create new
  const newProduct = await prisma.product.create({
    data: {
      householdId,
      name: item.productName,
      defaultUnit: "EACH",
    },
  });
  createdProducts.set(item.normalizedKey, newProduct.id);
  return newProduct.id;
}

export async function commitSyncAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const syncMode = formData.get("syncMode") as string;
  const listName = formData.get("listName") as string;
  const existingListId = formData.get("existingListId") as string;
  const itemsJson = formData.get("items") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  if (!itemsJson) return;

  let items: CommitItem[];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return;
  }

  if (items.length === 0) return;

  const createdProducts = new Map<string, string>();

  // ── Products Only ─────────────────────────────────────────────
  if (syncMode === "products-only") {
    for (const item of items) {
      await findOrCreateProduct(householdId, item, createdProducts);
    }

    revalidatePath("/products");
    revalidatePath("/mealie");
    redirect("/products");
  }

  // ── Add to Existing List ──────────────────────────────────────
  if (syncMode === "existing-list" && existingListId) {
    // Verify list belongs to household
    const list = await prisma.shoppingList.findFirst({
      where: { id: existingListId, householdId },
      include: { _count: { select: { items: true } } },
    });
    if (!list) redirect("/shopping-lists");

    // Start sort order after existing items
    let sortOrder = list._count.items;

    for (const item of items) {
      const productId = await findOrCreateProduct(householdId, item, createdProducts);

      // Check if this product is already on the list
      const existingItem = await prisma.shoppingListItem.findFirst({
        where: { listId: existingListId, productId },
        select: { id: true, quantity: true },
      });

      if (existingItem) {
        // Increment quantity instead of duplicating
        await prisma.shoppingListItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: { increment: item.quantity },
            notes: item.recipeNote,
          },
        });
      } else {
        await prisma.shoppingListItem.create({
          data: {
            listId: existingListId,
            productId,
            quantity: item.quantity,
            notes: item.recipeNote,
            sortOrder: sortOrder++,
          },
        });
      }
    }

    revalidatePath("/shopping-lists");
    revalidatePath(`/shopping-lists/${existingListId}`);
    revalidatePath("/products");
    revalidatePath("/mealie");
    redirect(`/shopping-lists/${existingListId}`);
  }

  // ── New List (default) ────────────────────────────────────────
  if (!listName?.trim()) return;

  const notes = startDate && endDate
    ? `Synced from Mealie: ${startDate} to ${endDate}`
    : "Synced from Mealie recipe";

  const list = await prisma.shoppingList.create({
    data: {
      householdId,
      name: listName.trim(),
      status: "DRAFT",
      notes,
    },
  });

  let sortOrder = 0;
  for (const item of items) {
    const productId = await findOrCreateProduct(householdId, item, createdProducts);

    await prisma.shoppingListItem.create({
      data: {
        listId: list.id,
        productId,
        quantity: item.quantity,
        notes: item.recipeNote,
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
