"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function logPriceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const productId = formData.get("productId") as string;
  const storeId = formData.get("storeId") as string;
  const priceStr = formData.get("price") as string;
  const observedAtStr = formData.get("observedAt") as string;
  const onSale = formData.get("onSale") === "on";
  const notes = (formData.get("notes") as string) || null;

  if (!productId || !storeId || !priceStr) return;

  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) return;

  // Verify product belongs to household
  const product = await prisma.product.findFirst({
    where: { id: productId, householdId },
    select: { id: true },
  });
  if (!product) return;

  // Verify store belongs to household
  const store = await prisma.store.findFirst({
    where: { id: storeId, householdId },
    select: { id: true },
  });
  if (!store) return;

  await prisma.storePrice.create({
    data: {
      productId,
      storeId,
      price,
      observedAt: observedAtStr ? new Date(observedAtStr) : new Date(),
      onSale,
      notes,
    },
  });

  revalidatePath(`/products/${productId}`);
  revalidatePath("/price-compare");
  revalidatePath("/products");
}

export async function deletePriceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const productId = formData.get("productId") as string;
  if (!id || !productId) return;

  // Verify price belongs to a product in this household
  const price = await prisma.storePrice.findFirst({
    where: {
      id,
      product: { householdId },
    },
    select: { id: true },
  });
  if (!price) return;

  await prisma.storePrice.delete({ where: { id } });

  revalidatePath(`/products/${productId}`);
  revalidatePath("/price-compare");
  revalidatePath("/products");
}
