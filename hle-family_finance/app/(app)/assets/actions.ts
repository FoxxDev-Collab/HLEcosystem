"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { AssetType } from "@prisma/client";

export async function createAssetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const type = formData.get("type") as AssetType;
  const currentValue = parseFloat(formData.get("currentValue") as string || "0");
  const purchasePrice = formData.get("purchasePrice") ? parseFloat(formData.get("purchasePrice") as string) : null;
  const purchaseDate = formData.get("purchaseDate") as string;
  const notes = formData.get("notes") as string || null;

  // Type-specific fields
  const address = formData.get("address") as string || null;
  const city = formData.get("city") as string || null;
  const state = formData.get("state") as string || null;
  const make = formData.get("make") as string || null;
  const model = formData.get("model") as string || null;
  const vehicleYear = formData.get("vehicleYear") ? parseInt(formData.get("vehicleYear") as string) : null;

  const asset = await prisma.asset.create({
    data: {
      householdId,
      name,
      type,
      currentValue,
      purchasePrice,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      valueAsOfDate: new Date(),
      notes,
      address, city, state,
      make, model, vehicleYear,
    },
  });

  // Record initial value history
  await prisma.assetValueHistory.create({
    data: {
      assetId: asset.id,
      date: new Date(),
      value: currentValue,
      source: "manual",
    },
  });

  revalidatePath("/assets");
  redirect("/assets");
}

export async function updateAssetValueAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const currentValue = parseFloat(formData.get("currentValue") as string);

  await prisma.asset.update({
    where: { id },
    data: { currentValue, valueAsOfDate: new Date() },
  });

  await prisma.assetValueHistory.create({
    data: { assetId: id, date: new Date(), value: currentValue, source: "manual" },
  });

  revalidatePath("/assets");
}

export async function archiveAssetAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const isArchived = formData.get("isArchived") === "true";

  await prisma.asset.update({
    where: { id },
    data: { isArchived: !isArchived },
  });

  revalidatePath("/assets");
}
