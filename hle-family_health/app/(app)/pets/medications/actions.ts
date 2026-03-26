"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createPetMedicationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const petId = formData.get("petId") as string;
  const pet = await prisma.pet.findFirst({ where: { id: petId, householdId } });
  if (!pet) return;

  const medicationName = formData.get("medicationName") as string;
  if (!medicationName) return;

  await prisma.petMedication.create({
    data: {
      petId,
      medicationName,
      dosage: (formData.get("dosage") as string) || null,
      frequency: (formData.get("frequency") as string) || null,
      startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string) : null,
      endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
      prescribedBy: (formData.get("prescribedBy") as string) || null,
      pharmacy: (formData.get("pharmacy") as string) || null,
      nextRefillDate: formData.get("nextRefillDate") ? new Date(formData.get("nextRefillDate") as string) : null,
      purpose: (formData.get("purpose") as string) || null,
      costPerRefill: formData.get("costPerRefill") ? parseFloat(formData.get("costPerRefill") as string) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/pets");
}

export async function updatePetMedicationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petMedication.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petMedication.update({
    where: { id },
    data: {
      medicationName: (formData.get("medicationName") as string) || record.medicationName,
      dosage: (formData.get("dosage") as string) || null,
      frequency: (formData.get("frequency") as string) || null,
      startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string) : null,
      endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
      isActive: formData.get("isActive") !== "false",
      prescribedBy: (formData.get("prescribedBy") as string) || null,
      pharmacy: (formData.get("pharmacy") as string) || null,
      nextRefillDate: formData.get("nextRefillDate") ? new Date(formData.get("nextRefillDate") as string) : null,
      purpose: (formData.get("purpose") as string) || null,
      costPerRefill: formData.get("costPerRefill") ? parseFloat(formData.get("costPerRefill") as string) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}

export async function deletePetMedicationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petMedication.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petMedication.delete({ where: { id } });
  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}
