"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { VehicleStatus } from "@prisma/client";

export async function createVehicleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const make = (formData.get("make") as string).trim();
  const model = (formData.get("model") as string).trim();
  if (!make || !model) return;

  await prisma.vehicle.create({
    data: {
      householdId,
      year: formData.get("year") ? parseInt(formData.get("year") as string) : null,
      make,
      model,
      trim: (formData.get("trim") as string) || null,
      vin: (formData.get("vin") as string) || null,
      licensePlate: (formData.get("licensePlate") as string) || null,
      color: (formData.get("color") as string) || null,
      currentMileage: formData.get("currentMileage") ? parseInt(formData.get("currentMileage") as string) : null,
      mileageAsOf: formData.get("currentMileage") ? new Date() : null,
      purchaseDate: formData.get("purchaseDate") ? new Date(formData.get("purchaseDate") as string) : null,
      purchasePrice: formData.get("purchasePrice") ? parseFloat(formData.get("purchasePrice") as string) : null,
      purchasedFrom: (formData.get("purchasedFrom") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
}

export async function updateVehicleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.vehicle.update({
    where: { id, householdId },
    data: {
      year: formData.get("year") ? parseInt(formData.get("year") as string) : null,
      make: (formData.get("make") as string).trim(),
      model: (formData.get("model") as string).trim(),
      trim: (formData.get("trim") as string) || null,
      vin: (formData.get("vin") as string) || null,
      licensePlate: (formData.get("licensePlate") as string) || null,
      color: (formData.get("color") as string) || null,
      currentMileage: formData.get("currentMileage") ? parseInt(formData.get("currentMileage") as string) : null,
      purchaseDate: formData.get("purchaseDate") ? new Date(formData.get("purchaseDate") as string) : null,
      purchasePrice: formData.get("purchasePrice") ? parseFloat(formData.get("purchasePrice") as string) : null,
      purchasedFrom: (formData.get("purchasedFrom") as string) || null,
      status: (formData.get("status") as VehicleStatus) || "ACTIVE",
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  revalidatePath("/dashboard");
}

export async function deleteVehicleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.vehicle.delete({
    where: { id, householdId },
  });

  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
  redirect("/vehicles");
}
