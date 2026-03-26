"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import type { BudgetCategory, Currency } from "@prisma/client";

export async function createBudgetItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const tripId = formData.get("tripId") as string;
  const category = formData.get("category") as BudgetCategory;
  const description = formData.get("description") as string;
  const plannedAmountStr = formData.get("plannedAmount") as string;
  const actualAmountStr = formData.get("actualAmount") as string;
  const currency = (formData.get("currency") as Currency) || "USD";
  const notes = (formData.get("notes") as string) || null;

  if (!tripId || !category || !description || !plannedAmountStr) {
    return { error: "Trip, category, description, and planned amount are required" };
  }

  const trip = await prisma.trip.findFirst({ where: { id: tripId, householdId } });
  if (!trip) return { error: "Trip not found" };

  try {
    await prisma.budgetItem.create({
      data: {
        tripId,
        category,
        description,
        plannedAmount: parseFloat(plannedAmountStr),
        actualAmount: actualAmountStr ? parseFloat(actualAmountStr) : null,
        currency,
        notes,
      },
    });
    revalidatePath(`/trips/${tripId}`);
    return {};
  } catch {
    return { error: "Failed to create budget item" };
  }
}

export async function updateBudgetItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const itemId = formData.get("itemId") as string;
  const category = formData.get("category") as BudgetCategory;
  const description = formData.get("description") as string;
  const plannedAmountStr = formData.get("plannedAmount") as string;
  const actualAmountStr = formData.get("actualAmount") as string;
  const currency = (formData.get("currency") as Currency) || "USD";
  const notes = (formData.get("notes") as string) || null;

  if (!itemId || !category || !description || !plannedAmountStr) {
    return { error: "Missing required fields" };
  }

  const item = await prisma.budgetItem.findFirst({
    where: { id: itemId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!item || item.trip.householdId !== householdId) return { error: "Budget item not found" };

  try {
    await prisma.budgetItem.update({
      where: { id: itemId },
      data: {
        category,
        description,
        plannedAmount: parseFloat(plannedAmountStr),
        actualAmount: actualAmountStr ? parseFloat(actualAmountStr) : null,
        currency,
        notes,
      },
    });
    revalidatePath(`/trips/${item.tripId}`);
    return {};
  } catch {
    return { error: "Failed to update budget item" };
  }
}

export async function deleteBudgetItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const itemId = formData.get("itemId") as string;
  if (!itemId) return { error: "Item ID required" };

  const item = await prisma.budgetItem.findFirst({
    where: { id: itemId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!item || item.trip.householdId !== householdId) return { error: "Budget item not found" };

  try {
    await prisma.budgetItem.delete({ where: { id: itemId } });
    revalidatePath(`/trips/${item.tripId}`);
    return {};
  } catch {
    return { error: "Failed to delete budget item" };
  }
}
