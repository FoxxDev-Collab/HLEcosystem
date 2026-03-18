"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createMileageEntryAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const vehicleId = formData.get("vehicleId") as string;
  const mileage = parseInt(formData.get("mileage") as string);
  const date = formData.get("date") as string;

  if (!vehicleId || isNaN(mileage) || !date) return;

  // Verify vehicle belongs to household
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, householdId },
  });
  if (!vehicle) return;

  await prisma.mileageEntry.create({
    data: {
      vehicleId,
      mileage,
      date: new Date(date),
      notes: (formData.get("notes") as string) || null,
    },
  });

  // Update vehicle's current mileage if this is the latest reading
  if (!vehicle.currentMileage || mileage > vehicle.currentMileage) {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentMileage: mileage, mileageAsOf: new Date(date) },
    });
  }

  revalidatePath("/mileage");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function deleteMileageEntryAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;

  await prisma.mileageEntry.delete({ where: { id } });

  revalidatePath("/mileage");
  revalidatePath("/vehicles");
}
