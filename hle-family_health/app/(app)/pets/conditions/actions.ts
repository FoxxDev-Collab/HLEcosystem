"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createPetConditionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const petId = formData.get("petId") as string;
  const pet = await prisma.pet.findFirst({ where: { id: petId, householdId } });
  if (!pet) return;

  const conditionName = formData.get("conditionName") as string;
  if (!conditionName) return;

  await prisma.petCondition.create({
    data: {
      petId,
      conditionName,
      diagnosedDate: formData.get("diagnosedDate") ? new Date(formData.get("diagnosedDate") as string) : null,
      isOngoing: formData.get("isOngoing") !== "false",
      severity: (formData.get("severity") as string) || null,
      treatment: (formData.get("treatment") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/pets");
}

export async function updatePetConditionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petCondition.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petCondition.update({
    where: { id },
    data: {
      conditionName: (formData.get("conditionName") as string) || record.conditionName,
      diagnosedDate: formData.get("diagnosedDate") ? new Date(formData.get("diagnosedDate") as string) : null,
      resolvedDate: formData.get("resolvedDate") ? new Date(formData.get("resolvedDate") as string) : null,
      isOngoing: formData.get("isOngoing") !== "false",
      severity: (formData.get("severity") as string) || null,
      treatment: (formData.get("treatment") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}

export async function deletePetConditionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petCondition.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petCondition.delete({ where: { id } });
  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}
