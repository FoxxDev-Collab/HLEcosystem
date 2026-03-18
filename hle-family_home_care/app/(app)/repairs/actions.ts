"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { RepairStatus } from "@prisma/client";

export async function createRepairAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const title = (formData.get("title") as string).trim();
  const reportedDate = formData.get("reportedDate") as string;
  if (!title || !reportedDate) return;

  const laborCost = formData.get("laborCost") ? parseFloat(formData.get("laborCost") as string) : null;
  const partsCost = formData.get("partsCost") ? parseFloat(formData.get("partsCost") as string) : null;
  const totalCost = (laborCost || 0) + (partsCost || 0) || null;

  await prisma.repair.create({
    data: {
      householdId,
      title,
      description: (formData.get("description") as string) || null,
      itemId: (formData.get("itemId") as string) || null,
      vehicleId: (formData.get("vehicleId") as string) || null,
      providerId: (formData.get("providerId") as string) || null,
      reportedDate: new Date(reportedDate),
      scheduledDate: formData.get("scheduledDate") ? new Date(formData.get("scheduledDate") as string) : null,
      completedBy: (formData.get("completedBy") as string) || null,
      laborCost,
      partsCost,
      totalCost,
      partsUsed: (formData.get("partsUsed") as string) || null,
      warrantyClaimId: (formData.get("warrantyClaimId") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/repairs");
  revalidatePath("/dashboard");
}

export async function updateRepairStatusAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const status = formData.get("status") as RepairStatus;

  const data: Record<string, unknown> = { status };
  if (status === "COMPLETED") {
    data.completedDate = new Date();
  }

  await prisma.repair.update({
    where: { id, householdId },
    data,
  });

  revalidatePath("/repairs");
  revalidatePath("/dashboard");
}

export async function updateRepairAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const laborCost = formData.get("laborCost") ? parseFloat(formData.get("laborCost") as string) : null;
  const partsCost = formData.get("partsCost") ? parseFloat(formData.get("partsCost") as string) : null;
  const totalCost = (laborCost || 0) + (partsCost || 0) || null;

  await prisma.repair.update({
    where: { id, householdId },
    data: {
      title: (formData.get("title") as string).trim(),
      description: (formData.get("description") as string) || null,
      itemId: (formData.get("itemId") as string) || null,
      vehicleId: (formData.get("vehicleId") as string) || null,
      providerId: (formData.get("providerId") as string) || null,
      status: (formData.get("status") as RepairStatus) || "SCHEDULED",
      scheduledDate: formData.get("scheduledDate") ? new Date(formData.get("scheduledDate") as string) : null,
      completedDate: formData.get("completedDate") ? new Date(formData.get("completedDate") as string) : null,
      completedBy: (formData.get("completedBy") as string) || null,
      laborCost,
      partsCost,
      totalCost,
      partsUsed: (formData.get("partsUsed") as string) || null,
      warrantyClaimId: (formData.get("warrantyClaimId") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/repairs");
  revalidatePath("/dashboard");
}

export async function deleteRepairAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.repair.delete({
    where: { id, householdId },
  });

  revalidatePath("/repairs");
  revalidatePath("/dashboard");
}
