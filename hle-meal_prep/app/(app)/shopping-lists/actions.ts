"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ListStatus, ProductUnit } from "@prisma/client";

export async function createListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  if (!name?.trim()) return;

  const notes = (formData.get("notes") as string) || null;

  await prisma.shoppingList.create({
    data: {
      householdId,
      name: name.trim(),
      status: "DRAFT",
      notes,
    },
  });

  revalidatePath("/shopping-lists");
}

export async function updateListStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const status = formData.get("status") as ListStatus;
  if (!id || !status) return;

  await prisma.shoppingList.updateMany({
    where: { id, householdId },
    data: { status },
  });

  revalidatePath("/shopping-lists");
  revalidatePath(`/shopping-lists/${id}`);
}

export async function deleteListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.shoppingList.deleteMany({ where: { id, householdId } });
  revalidatePath("/shopping-lists");
}

export async function addListItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const listId = formData.get("listId") as string;
  const productId = formData.get("productId") as string;
  if (!listId || !productId) return;

  // Verify list belongs to household
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, householdId },
    select: { id: true },
  });
  if (!list) return;

  const quantityStr = formData.get("quantity") as string;
  const quantity = quantityStr ? parseFloat(quantityStr) : 1;
  const unit = (formData.get("unit") as ProductUnit) || null;
  const notes = (formData.get("notes") as string) || null;

  await prisma.shoppingListItem.create({
    data: {
      listId,
      productId,
      quantity,
      unit,
      notes,
    },
  });

  revalidatePath(`/shopping-lists/${listId}`);
  revalidatePath("/shopping-lists");
}

export async function toggleListItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const listId = formData.get("listId") as string;
  if (!id) return;

  const item = await prisma.shoppingListItem.findFirst({
    where: { id, list: { householdId } },
    select: { isChecked: true },
  });
  if (!item) return;

  await prisma.shoppingListItem.update({
    where: { id },
    data: { isChecked: !item.isChecked },
  });

  revalidatePath(`/shopping-lists/${listId}`);
}

export async function removeListItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const listId = formData.get("listId") as string;
  if (!id) return;

  // Verify item belongs to a list in this household
  const item = await prisma.shoppingListItem.findFirst({
    where: { id, list: { householdId } },
    select: { id: true },
  });
  if (!item) return;

  await prisma.shoppingListItem.delete({ where: { id } });

  revalidatePath(`/shopping-lists/${listId}`);
  revalidatePath("/shopping-lists");
}

export async function assignStoreAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const storeId = (formData.get("storeId") as string) || null;
  const listId = formData.get("listId") as string;
  if (!id) return;

  const item = await prisma.shoppingListItem.findFirst({
    where: { id, list: { householdId } },
    select: { id: true },
  });
  if (!item) return;

  await prisma.shoppingListItem.update({
    where: { id },
    data: { storeId },
  });

  revalidatePath(`/shopping-lists/${listId}`);
}
