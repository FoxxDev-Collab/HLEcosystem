"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createPetVaccinationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const petId = formData.get("petId") as string;
  const pet = await prisma.pet.findFirst({ where: { id: petId, householdId } });
  if (!pet) return;

  const vaccineName = formData.get("vaccineName") as string;
  if (!vaccineName) return;

  await prisma.petVaccination.create({
    data: {
      petId,
      vaccineName,
      doseNumber: (formData.get("doseNumber") as string) || null,
      dateAdministered: new Date(formData.get("dateAdministered") as string),
      nextDueDate: formData.get("nextDueDate") ? new Date(formData.get("nextDueDate") as string) : null,
      administeredBy: (formData.get("administeredBy") as string) || null,
      providerId: (formData.get("providerId") as string) || null,
      lotNumber: (formData.get("lotNumber") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/pets");
}

export async function updatePetVaccinationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petVaccination.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petVaccination.update({
    where: { id },
    data: {
      vaccineName: (formData.get("vaccineName") as string) || record.vaccineName,
      doseNumber: (formData.get("doseNumber") as string) || null,
      dateAdministered: formData.get("dateAdministered") ? new Date(formData.get("dateAdministered") as string) : record.dateAdministered,
      nextDueDate: formData.get("nextDueDate") ? new Date(formData.get("nextDueDate") as string) : null,
      administeredBy: (formData.get("administeredBy") as string) || null,
      providerId: (formData.get("providerId") as string) || null,
      lotNumber: (formData.get("lotNumber") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}

export async function deletePetVaccinationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petVaccination.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petVaccination.delete({ where: { id } });
  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}
