"use server";

import { revalidatePath } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { CategoryType } from "@prisma/client";

export async function createCategoryAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const name = formData.get("name") as string;
  const type = formData.get("type") as CategoryType;
  const color = formData.get("color") as string || null;
  const icon = formData.get("icon") as string || null;
  const parentCategoryId = formData.get("parentCategoryId") as string || null;

  await prisma.category.create({
    data: { householdId, name, type, color, icon, parentCategoryId },
  });

  revalidatePath("/categories");
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const color = formData.get("color") as string || null;

  await prisma.category.update({
    where: { id },
    data: { name, color },
  });

  revalidatePath("/categories");
}

export async function archiveCategoryAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const isArchived = formData.get("isArchived") === "true";

  await prisma.category.update({
    where: { id },
    data: { isArchived: !isArchived },
  });

  revalidatePath("/categories");
}
