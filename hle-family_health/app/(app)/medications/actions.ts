"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createMedicationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyMemberId = formData.get("familyMemberId") as string;

  // Verify familyMember belongs to household
  const member = await prisma.familyMember.findFirst({ where: { id: familyMemberId, householdId } });
  if (!member) return;

  const medicationName = formData.get("medicationName") as string;
  const dosage = formData.get("dosage") as string || null;
  const frequency = formData.get("frequency") as string || null;
  const prescribedBy = formData.get("prescribedBy") as string || null;
  const pharmacy = formData.get("pharmacy") as string || null;
  const purpose = formData.get("purpose") as string || null;
  const startDate = formData.get("startDate") as string;
  const nextRefillDate = formData.get("nextRefillDate") as string;
  const refillsRemaining = formData.get("refillsRemaining") ? parseInt(formData.get("refillsRemaining") as string) : null;
  const costPerRefill = formData.get("costPerRefill") ? parseFloat(formData.get("costPerRefill") as string) : null;
  const paidFromHsa = formData.get("paidFromHsa") === "on";

  await prisma.medication.create({
    data: {
      familyMemberId,
      medicationName,
      dosage,
      frequency,
      prescribedBy,
      pharmacy,
      purpose,
      startDate: startDate ? new Date(startDate) : null,
      nextRefillDate: nextRefillDate ? new Date(nextRefillDate) : null,
      refillsRemaining,
      costPerRefill,
      paidFromHsa,
    },
  });

  revalidatePath("/medications");
  revalidatePath("/dashboard");
}

export async function toggleMedicationActiveAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";

  const record = await prisma.medication.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!record) return;

  await prisma.medication.update({
    where: { id },
    data: { isActive: !isActive },
  });

  revalidatePath("/medications");
  revalidatePath("/dashboard");
}

export async function recordRefillAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const med = await prisma.medication.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!med) return;

  const today = new Date();
  const newRefills = med.refillsRemaining !== null ? Math.max(0, med.refillsRemaining - 1) : null;

  await prisma.medication.update({
    where: { id },
    data: {
      lastRefillDate: today,
      refillsRemaining: newRefills,
    },
  });

  revalidatePath("/medications");
  revalidatePath("/dashboard");
}

export async function deleteMedicationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const record = await prisma.medication.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!record) return;

  await prisma.medication.delete({ where: { id } });
  revalidatePath("/medications");
  revalidatePath("/dashboard");
}
