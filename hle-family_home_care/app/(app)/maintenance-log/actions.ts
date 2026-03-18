"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createMaintenanceLogAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const title = (formData.get("title") as string).trim();
  const completedDate = formData.get("completedDate") as string;
  if (!title || !completedDate) return;

  await prisma.maintenanceLog.create({
    data: {
      householdId,
      title,
      description: (formData.get("description") as string) || null,
      itemId: (formData.get("itemId") as string) || null,
      vehicleId: (formData.get("vehicleId") as string) || null,
      completedDate: new Date(completedDate),
      completedBy: (formData.get("completedBy") as string) || null,
      cost: formData.get("cost") ? parseFloat(formData.get("cost") as string) : null,
      mileageAtService: formData.get("mileageAtService") ? parseInt(formData.get("mileageAtService") as string) : null,
      partsUsed: (formData.get("partsUsed") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/maintenance-log");
  revalidatePath("/dashboard");
}

export async function deleteMaintenanceLogAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.maintenanceLog.delete({
    where: { id, householdId },
  });

  revalidatePath("/maintenance-log");
  revalidatePath("/dashboard");
}
