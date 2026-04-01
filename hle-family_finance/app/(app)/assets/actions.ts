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

  const linkedDebtIdRaw = formData.get("linkedDebtId") as string;
  const linkedDebtId = linkedDebtIdRaw && linkedDebtIdRaw !== "none" ? linkedDebtIdRaw : null;

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
      linkedDebtId,
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

export async function updateAssetAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return { error: "Asset not found" };
  }

  const name = formData.get("name") as string;
  const type = formData.get("type") as AssetType;
  const currentValue = parseFloat(formData.get("currentValue") as string || "0");
  const purchasePrice = formData.get("purchasePrice") ? parseFloat(formData.get("purchasePrice") as string) : null;
  const purchaseDate = formData.get("purchaseDate") as string;
  const notes = (formData.get("notes") as string) || null;
  const linkedDebtIdRaw = formData.get("linkedDebtId") as string;
  const linkedDebtId = linkedDebtIdRaw && linkedDebtIdRaw !== "none" ? linkedDebtIdRaw : null;

  // Type-specific fields
  const address = (formData.get("address") as string) || null;
  const city = (formData.get("city") as string) || null;
  const state = (formData.get("state") as string) || null;
  const zipCode = (formData.get("zipCode") as string) || null;
  const squareFootage = formData.get("squareFootage") ? parseInt(formData.get("squareFootage") as string) : null;
  const yearBuilt = formData.get("yearBuilt") ? parseInt(formData.get("yearBuilt") as string) : null;
  const propertyTaxAnnual = formData.get("propertyTaxAnnual") ? parseFloat(formData.get("propertyTaxAnnual") as string) : null;
  const make = (formData.get("make") as string) || null;
  const model = (formData.get("model") as string) || null;
  const vehicleYear = formData.get("vehicleYear") ? parseInt(formData.get("vehicleYear") as string) : null;
  const vin = (formData.get("vin") as string) || null;
  const mileage = formData.get("mileage") ? parseInt(formData.get("mileage") as string) : null;

  await prisma.asset.update({
    where: { id },
    data: {
      name, type, currentValue,
      purchasePrice,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      valueAsOfDate: new Date(),
      notes, linkedDebtId,
      address, city, state, zipCode,
      squareFootage, yearBuilt, propertyTaxAnnual,
      make, model, vehicleYear, vin, mileage,
    },
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return {};
}

export async function deleteAssetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) return;

  // Value history cascade-deletes via schema
  await prisma.asset.delete({ where: { id } });

  revalidatePath("/assets");
  redirect("/assets");
}

export async function markAssetSoldAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const soldPrice = parseFloat(formData.get("soldPrice") as string);
  const soldDate = formData.get("soldDate") as string;
  const archiveDebt = formData.get("archiveDebt") === "true";

  const existing = await prisma.asset.findUnique({
    where: { id },
    include: { linkedDebt: true },
  });
  if (!existing || existing.householdId !== householdId) {
    return { error: "Asset not found" };
  }

  // Mark asset as sold and archive it
  await prisma.asset.update({
    where: { id },
    data: {
      isSold: true,
      soldPrice,
      soldDate: soldDate ? new Date(soldDate) : new Date(),
      isArchived: true,
    },
  });

  // Record final value in history
  await prisma.assetValueHistory.create({
    data: {
      assetId: id,
      date: soldDate ? new Date(soldDate) : new Date(),
      value: soldPrice,
      source: "sold",
      notes: "Asset sold",
    },
  });

  // Optionally archive the linked debt
  if (archiveDebt && existing.linkedDebtId) {
    await prisma.debt.update({
      where: { id: existing.linkedDebtId },
      data: { isArchived: true },
    });
    revalidatePath("/debts");
  }

  revalidatePath("/assets");
  redirect("/assets");
}
