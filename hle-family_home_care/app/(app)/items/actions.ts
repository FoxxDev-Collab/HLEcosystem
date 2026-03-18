"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ItemCondition } from "@prisma/client";

export async function createItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = (formData.get("name") as string).trim();
  if (!name) return;

  await prisma.item.create({
    data: {
      householdId,
      name,
      roomId: (formData.get("roomId") as string) || null,
      description: (formData.get("description") as string) || null,
      manufacturer: (formData.get("manufacturer") as string) || null,
      model: (formData.get("model") as string) || null,
      serialNumber: (formData.get("serialNumber") as string) || null,
      purchaseDate: formData.get("purchaseDate") ? new Date(formData.get("purchaseDate") as string) : null,
      purchasePrice: formData.get("purchasePrice") ? parseFloat(formData.get("purchasePrice") as string) : null,
      purchasedFrom: (formData.get("purchasedFrom") as string) || null,
      warrantyExpires: formData.get("warrantyExpires") ? new Date(formData.get("warrantyExpires") as string) : null,
      warrantyNotes: (formData.get("warrantyNotes") as string) || null,
      condition: (formData.get("condition") as ItemCondition) || "GOOD",
      manualUrl: (formData.get("manualUrl") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/items");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
}

export async function updateItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.item.update({
    where: { id, householdId },
    data: {
      name: (formData.get("name") as string).trim(),
      roomId: (formData.get("roomId") as string) || null,
      description: (formData.get("description") as string) || null,
      manufacturer: (formData.get("manufacturer") as string) || null,
      model: (formData.get("model") as string) || null,
      serialNumber: (formData.get("serialNumber") as string) || null,
      purchaseDate: formData.get("purchaseDate") ? new Date(formData.get("purchaseDate") as string) : null,
      purchasePrice: formData.get("purchasePrice") ? parseFloat(formData.get("purchasePrice") as string) : null,
      purchasedFrom: (formData.get("purchasedFrom") as string) || null,
      warrantyExpires: formData.get("warrantyExpires") ? new Date(formData.get("warrantyExpires") as string) : null,
      warrantyNotes: (formData.get("warrantyNotes") as string) || null,
      condition: (formData.get("condition") as ItemCondition) || "GOOD",
      manualUrl: (formData.get("manualUrl") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/items");
  revalidatePath(`/items/${id}`);
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.item.delete({
    where: { id, householdId },
  });

  revalidatePath("/items");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  redirect("/items");
}

export async function archiveItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.item.update({
    where: { id, householdId },
    data: { isArchived: true },
  });

  revalidatePath("/items");
  revalidatePath(`/items/${id}`);
  revalidatePath("/dashboard");
}
