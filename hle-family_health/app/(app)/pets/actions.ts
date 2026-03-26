"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { Species } from "@prisma/client";

export async function createPetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  if (!name) return;

  await prisma.pet.create({
    data: {
      householdId,
      name,
      species: (formData.get("species") as Species) || "DOG",
      breed: (formData.get("breed") as string) || null,
      color: (formData.get("color") as string) || null,
      weightLbs: formData.get("weightLbs") ? parseFloat(formData.get("weightLbs") as string) : null,
      dateOfBirth: formData.get("dateOfBirth") ? new Date(formData.get("dateOfBirth") as string) : null,
      gender: (formData.get("gender") as string) || null,
      microchipId: (formData.get("microchipId") as string) || null,
      adoptionDate: formData.get("adoptionDate") ? new Date(formData.get("adoptionDate") as string) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/pets");
}

export async function updatePetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const pet = await prisma.pet.findFirst({ where: { id, householdId } });
  if (!pet) return;

  await prisma.pet.update({
    where: { id },
    data: {
      name: (formData.get("name") as string) || pet.name,
      species: (formData.get("species") as Species) || pet.species,
      breed: (formData.get("breed") as string) || null,
      color: (formData.get("color") as string) || null,
      weightLbs: formData.get("weightLbs") ? parseFloat(formData.get("weightLbs") as string) : null,
      dateOfBirth: formData.get("dateOfBirth") ? new Date(formData.get("dateOfBirth") as string) : null,
      gender: (formData.get("gender") as string) || null,
      microchipId: (formData.get("microchipId") as string) || null,
      adoptionDate: formData.get("adoptionDate") ? new Date(formData.get("adoptionDate") as string) : null,
      notes: (formData.get("notes") as string) || null,
      isActive: formData.get("isActive") !== "false",
    },
  });

  revalidatePath("/pets");
  revalidatePath(`/pets/${id}`);
}

export async function deletePetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const pet = await prisma.pet.findFirst({ where: { id, householdId } });
  if (!pet) return;

  await prisma.pet.delete({ where: { id } });
  revalidatePath("/pets");
  redirect("/pets");
}
