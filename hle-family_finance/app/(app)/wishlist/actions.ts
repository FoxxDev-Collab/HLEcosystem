"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createWishlistAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;

  const wishlist = await prisma.wishlist.create({
    data: { householdId, name, description },
  });

  revalidatePath("/wishlist");
  redirect(`/wishlist/${wishlist.id}`);
}

export async function updateWishlistAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;

  await prisma.wishlist.update({
    where: { id },
    data: { name, description },
  });

  revalidatePath(`/wishlist/${id}`);
  revalidatePath("/wishlist");
}

export async function deleteWishlistAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  await prisma.wishlist.delete({ where: { id } });

  revalidatePath("/wishlist");
  redirect("/wishlist");
}

export async function addWishlistItemAction(formData: FormData): Promise<void> {
  const wishlistId = formData.get("wishlistId") as string;
  const name = formData.get("name") as string;
  const lowPriceStr = formData.get("lowPrice") as string;
  const highPriceStr = formData.get("highPrice") as string;
  const url = (formData.get("url") as string) || null;

  await prisma.wishlistItem.create({
    data: {
      wishlistId,
      name,
      lowPrice: lowPriceStr ? parseFloat(lowPriceStr) : null,
      highPrice: highPriceStr ? parseFloat(highPriceStr) : null,
      url,
    },
  });

  revalidatePath(`/wishlist/${wishlistId}`);
  revalidatePath("/wishlist");
}

export async function updateWishlistItemAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const wishlistId = formData.get("wishlistId") as string;
  const name = formData.get("name") as string;
  const lowPriceStr = formData.get("lowPrice") as string;
  const highPriceStr = formData.get("highPrice") as string;
  const url = (formData.get("url") as string) || null;

  await prisma.wishlistItem.update({
    where: { id },
    data: {
      name,
      lowPrice: lowPriceStr ? parseFloat(lowPriceStr) : null,
      highPrice: highPriceStr ? parseFloat(highPriceStr) : null,
      url,
    },
  });

  revalidatePath(`/wishlist/${wishlistId}`);
}

export async function toggleWishlistItemAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const isPurchased = formData.get("isPurchased") === "true";
  const wishlistId = formData.get("wishlistId") as string;

  await prisma.wishlistItem.update({
    where: { id },
    data: { isPurchased: !isPurchased },
  });

  revalidatePath(`/wishlist/${wishlistId}`);
  revalidatePath("/wishlist");
}

export async function deleteWishlistItemAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const wishlistId = formData.get("wishlistId") as string;

  await prisma.wishlistItem.delete({ where: { id } });

  revalidatePath(`/wishlist/${wishlistId}`);
  revalidatePath("/wishlist");
}
