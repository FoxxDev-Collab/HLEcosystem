"use server";

import { revalidatePath } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { GiftIdeaPriority } from "@prisma/client";

export async function createGiftIdeaAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const familyMemberId = formData.get("familyMemberId") as string;
  const estimatedCost = formData.get("estimatedCost") as string;

  await prisma.giftIdea.create({
    data: {
      householdId,
      familyMemberId: familyMemberId || null,
      idea: formData.get("idea") as string,
      source: (formData.get("source") as string) || null,
      priority: (formData.get("priority") as GiftIdeaPriority) || "MEDIUM",
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
      url: (formData.get("url") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/gift-ideas");
  revalidatePath("/dashboard");
}

export async function updateGiftIdeaAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  const estimatedCost = formData.get("estimatedCost") as string;

  await prisma.giftIdea.update({
    where: { id, householdId },
    data: {
      familyMemberId: familyMemberId || null,
      idea: formData.get("idea") as string,
      source: (formData.get("source") as string) || null,
      priority: (formData.get("priority") as GiftIdeaPriority) || "MEDIUM",
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
      url: (formData.get("url") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/gift-ideas");
}

export async function markIdeaPurchasedAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  await prisma.giftIdea.update({
    where: { id, householdId },
    data: { status: "PURCHASED" },
  });

  revalidatePath("/gift-ideas");
  revalidatePath("/dashboard");
}

export async function convertIdeaToGiftAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const idea = await prisma.giftIdea.findUnique({ where: { id, householdId } });
  if (!idea || !idea.familyMemberId) return;

  await prisma.$transaction([
    prisma.gift.create({
      data: {
        householdId,
        familyMemberId: idea.familyMemberId,
        description: idea.idea,
        status: "PURCHASED",
        estimatedCost: idea.estimatedCost,
        notes: idea.notes,
      },
    }),
    prisma.giftIdea.delete({ where: { id } }),
  ]);

  revalidatePath("/gift-ideas");
  revalidatePath("/gifts");
  revalidatePath("/dashboard");
}

export async function deleteGiftIdeaAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  await prisma.giftIdea.delete({ where: { id, householdId } });

  revalidatePath("/gift-ideas");
  revalidatePath("/dashboard");
}
