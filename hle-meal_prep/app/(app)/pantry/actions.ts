"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ProductUnit } from "@prisma/client";

export async function addToPantryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const productId = formData.get("productId") as string;
  if (!productId) return;

  const quantity = parseFloat(formData.get("quantity") as string);
  if (isNaN(quantity) || quantity < 0) return;

  const unit = (formData.get("unit") as ProductUnit) || null;
  const minQuantity = parseFloat(formData.get("minQuantity") as string);
  const expiresAtStr = formData.get("expiresAt") as string;
  const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;

  // Verify product belongs to household
  const product = await prisma.product.findFirst({
    where: { id: productId, householdId },
  });
  if (!product) return;

  // Check if already in pantry
  const existing = await prisma.pantryItem.findUnique({
    where: { productId },
  });
  if (existing) return;

  await prisma.pantryItem.create({
    data: {
      householdId,
      productId,
      quantity,
      unit: unit || product.defaultUnit,
      minQuantity: isNaN(minQuantity) ? null : minQuantity,
      expiresAt,
    },
  });

  revalidatePath("/pantry");
}

export async function updatePantryQuantityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  const quantity = parseFloat(formData.get("quantity") as string);
  if (isNaN(quantity) || quantity < 0) return;

  await prisma.pantryItem.updateMany({
    where: { id, householdId },
    data: { quantity },
  });

  revalidatePath("/pantry");
}

export async function adjustPantryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  const amount = parseFloat(formData.get("amount") as string);
  if (isNaN(amount)) return;

  const item = await prisma.pantryItem.findFirst({
    where: { id, householdId },
  });
  if (!item) return;

  const newQuantity = Math.max(0, Number(item.quantity) + amount);

  await prisma.pantryItem.updateMany({
    where: { id, householdId },
    data: { quantity: newQuantity },
  });

  revalidatePath("/pantry");
}

export async function setPantryMinAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  const minQuantityStr = formData.get("minQuantity") as string;
  const minQuantity = minQuantityStr ? parseFloat(minQuantityStr) : null;

  if (minQuantity !== null && (isNaN(minQuantity) || minQuantity < 0)) return;

  await prisma.pantryItem.updateMany({
    where: { id, householdId },
    data: { minQuantity },
  });

  revalidatePath("/pantry");
}

export async function setExpirationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  const expiresAtStr = formData.get("expiresAt") as string;
  const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;

  await prisma.pantryItem.updateMany({
    where: { id, householdId },
    data: { expiresAt },
  });

  revalidatePath("/pantry");
}

export async function removeFromPantryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.pantryItem.deleteMany({
    where: { id, householdId },
  });

  revalidatePath("/pantry");
}

export async function stockFromListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const listId = formData.get("listId") as string;
  if (!listId) return;

  // Verify list belongs to household
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, householdId },
    include: {
      items: {
        where: { isChecked: true },
        include: { product: true },
      },
    },
  });
  if (!list) return;

  for (const item of list.items) {
    const existing = await prisma.pantryItem.findUnique({
      where: { productId: item.productId },
    });

    if (existing && existing.householdId === householdId) {
      // Increment existing pantry item
      await prisma.pantryItem.update({
        where: { id: existing.id },
        data: {
          quantity: Number(existing.quantity) + Number(item.quantity),
        },
      });
    } else {
      // Create new pantry item
      await prisma.pantryItem.create({
        data: {
          householdId,
          productId: item.productId,
          quantity: Number(item.quantity),
          unit: item.unit || item.product.defaultUnit,
        },
      });
    }
  }

  revalidatePath("/pantry");
  revalidatePath("/shopping-lists");
}
