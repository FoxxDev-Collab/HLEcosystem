"use server";

import { revalidatePath } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { GiftStatus } from "@prisma/client";

export async function createGiftAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const giftDate = formData.get("giftDate") as string;
  const estimatedCost = formData.get("estimatedCost") as string;
  const actualCost = formData.get("actualCost") as string;
  const rating = formData.get("rating") as string;

  await prisma.gift.create({
    data: {
      householdId,
      familyMemberId: formData.get("familyMemberId") as string,
      description: formData.get("description") as string,
      giftDate: giftDate ? new Date(giftDate) : null,
      occasion: (formData.get("occasion") as string) || null,
      status: (formData.get("status") as GiftStatus) || "IDEA",
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
      actualCost: actualCost ? parseFloat(actualCost) : null,
      rating: rating ? parseInt(rating) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/gifts");
  revalidatePath("/dashboard");
}

export async function updateGiftAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const giftDate = formData.get("giftDate") as string;
  const estimatedCost = formData.get("estimatedCost") as string;
  const actualCost = formData.get("actualCost") as string;
  const rating = formData.get("rating") as string;

  await prisma.gift.update({
    where: { id, householdId },
    data: {
      familyMemberId: formData.get("familyMemberId") as string,
      description: formData.get("description") as string,
      giftDate: giftDate ? new Date(giftDate) : null,
      occasion: (formData.get("occasion") as string) || null,
      status: (formData.get("status") as GiftStatus) || "IDEA",
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
      actualCost: actualCost ? parseFloat(actualCost) : null,
      rating: rating ? parseInt(rating) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/gifts");
  revalidatePath("/dashboard");
}

export async function updateGiftStatusAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const status = formData.get("status") as GiftStatus;

  await prisma.gift.update({
    where: { id, householdId },
    data: { status },
  });

  revalidatePath("/gifts");
  revalidatePath("/dashboard");
}

export async function deleteGiftAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  await prisma.gift.delete({ where: { id, householdId } });

  revalidatePath("/gifts");
  revalidatePath("/dashboard");
}
