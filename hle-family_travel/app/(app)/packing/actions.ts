"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import type { PackingCategory } from "@prisma/client";

export async function createPackingListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  const name = formData.get("name") as string;

  if (!tripId || !name) return { error: "Trip and name are required" };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  try {
    await prisma.packingList.create({ data: { tripId, name } });
    revalidatePath(`/trips/${tripId}`);
    return {};
  } catch {
    return { error: "Failed to create packing list" };
  }
}

export async function updatePackingListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const listId = formData.get("listId") as string;
  const name = formData.get("name") as string;

  if (!listId || !name) return { error: "Missing required fields" };

  const list = await prisma.packingList.findFirst({
    where: { id: listId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!list || list.trip.householdId !== householdId) return { error: "List not found" };

  try {
    await prisma.packingList.update({ where: { id: listId }, data: { name } });
    revalidatePath(`/trips/${list.tripId}`);
    return {};
  } catch {
    return { error: "Failed to update packing list" };
  }
}

export async function deletePackingListAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const listId = formData.get("listId") as string;
  if (!listId) return { error: "List ID required" };

  const list = await prisma.packingList.findFirst({
    where: { id: listId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!list || list.trip.householdId !== householdId) return { error: "List not found" };

  try {
    await prisma.packingList.delete({ where: { id: listId } });
    revalidatePath(`/trips/${list.tripId}`);
    return {};
  } catch {
    return { error: "Failed to delete packing list" };
  }
}

export async function addPackingItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const packingListId = formData.get("packingListId") as string;
  const name = formData.get("name") as string;
  const category = (formData.get("category") as PackingCategory) || "OTHER";
  const quantityStr = formData.get("quantity") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!packingListId || !name) return { error: "List and item name are required" };

  const list = await prisma.packingList.findFirst({
    where: { id: packingListId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!list || list.trip.householdId !== householdId) return { error: "List not found" };

  const existingItems = await prisma.packingItem.count({ where: { packingListId } });

  try {
    await prisma.packingItem.create({
      data: {
        packingListId,
        name,
        category,
        quantity: quantityStr ? parseInt(quantityStr, 10) : 1,
        notes,
        sortOrder: existingItems,
      },
    });
    revalidatePath(`/trips/${list.tripId}`);
    return {};
  } catch {
    return { error: "Failed to add packing item" };
  }
}

export async function updatePackingItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const itemId = formData.get("itemId") as string;
  const name = formData.get("name") as string;
  const category = (formData.get("category") as PackingCategory) || "OTHER";
  const quantityStr = formData.get("quantity") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!itemId || !name) return { error: "Missing required fields" };

  const item = await prisma.packingItem.findFirst({
    where: { id: itemId },
    include: { packingList: { include: { trip: { select: { householdId: true } } } } },
  });
  if (!item || item.packingList.trip.householdId !== householdId) {
    return { error: "Item not found" };
  }

  try {
    await prisma.packingItem.update({
      where: { id: itemId },
      data: {
        name,
        category,
        quantity: quantityStr ? parseInt(quantityStr, 10) : 1,
        notes,
      },
    });
    revalidatePath(`/trips/${item.packingList.tripId}`);
    return {};
  } catch {
    return { error: "Failed to update packing item" };
  }
}

export async function togglePackingItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const itemId = formData.get("itemId") as string;
  if (!itemId) return { error: "Item ID required" };

  const item = await prisma.packingItem.findFirst({
    where: { id: itemId },
    include: { packingList: { include: { trip: { select: { householdId: true } } } } },
  });
  if (!item || item.packingList.trip.householdId !== householdId) {
    return { error: "Item not found" };
  }

  try {
    await prisma.packingItem.update({
      where: { id: itemId },
      data: { isPacked: !item.isPacked },
    });
    revalidatePath(`/trips/${item.packingList.tripId}`);
    return {};
  } catch {
    return { error: "Failed to toggle packing item" };
  }
}

export async function deletePackingItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const itemId = formData.get("itemId") as string;
  if (!itemId) return { error: "Item ID required" };

  const item = await prisma.packingItem.findFirst({
    where: { id: itemId },
    include: { packingList: { include: { trip: { select: { householdId: true } } } } },
  });
  if (!item || item.packingList.trip.householdId !== householdId) {
    return { error: "Item not found" };
  }

  try {
    await prisma.packingItem.delete({ where: { id: itemId } });
    revalidatePath(`/trips/${item.packingList.tripId}`);
    return {};
  } catch {
    return { error: "Failed to delete packing item" };
  }
}
