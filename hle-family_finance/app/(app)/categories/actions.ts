"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { CategoryType } from "@prisma/client";

export async function createCategoryAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

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
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const color = formData.get("color") as string || null;

  await prisma.category.update({
    where: { id, householdId },
    data: { name, color },
  });

  revalidatePath("/categories");
}

export async function archiveCategoryAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const isArchived = formData.get("isArchived") === "true";

  await prisma.category.update({
    where: { id, householdId },
    data: { isArchived: !isArchived },
  });

  revalidatePath("/categories");
}
