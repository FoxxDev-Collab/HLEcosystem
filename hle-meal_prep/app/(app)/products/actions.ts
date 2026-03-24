"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ProductUnit } from "@prisma/client";

export async function createProductAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  if (!name?.trim()) return;

  const categoryId = (formData.get("categoryId") as string) || null;
  const brand = (formData.get("brand") as string) || null;
  const defaultUnit = (formData.get("defaultUnit") as ProductUnit) || "EACH";
  const notes = (formData.get("notes") as string) || null;

  await prisma.product.create({
    data: {
      householdId,
      name: name.trim(),
      categoryId,
      brand: brand?.trim() || null,
      defaultUnit,
      notes: notes?.trim() || null,
    },
  });

  revalidatePath("/products");
}

export async function updateProductAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  const name = formData.get("name") as string;
  const categoryId = (formData.get("categoryId") as string) || null;
  const brand = (formData.get("brand") as string) || null;
  const defaultUnit = (formData.get("defaultUnit") as ProductUnit) || "EACH";
  const notes = (formData.get("notes") as string) || null;

  await prisma.product.updateMany({
    where: { id, householdId },
    data: {
      name: name?.trim() || undefined,
      categoryId,
      brand: brand?.trim() || null,
      defaultUnit,
      notes: notes?.trim() || null,
    },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

export async function deleteProductAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.product.deleteMany({ where: { id, householdId } });
  revalidatePath("/products");
}

export async function toggleFavoriteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  const product = await prisma.product.findFirst({
    where: { id, householdId },
    select: { isFavorite: true },
  });
  if (!product) return;

  await prisma.product.updateMany({
    where: { id, householdId },
    data: { isFavorite: !product.isFavorite },
  });

  revalidatePath("/products");
}

export async function createCategoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  if (!name?.trim()) return;

  await prisma.category.create({
    data: {
      householdId,
      name: name.trim(),
    },
  });

  revalidatePath("/products");
}
