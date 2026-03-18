"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ProviderSpecialty } from "@prisma/client";

export async function createProviderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = (formData.get("name") as string).trim();
  if (!name) return;

  await prisma.serviceProvider.create({
    data: {
      householdId,
      name,
      company: (formData.get("company") as string) || null,
      specialty: (formData.get("specialty") as ProviderSpecialty) || "OTHER",
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      website: (formData.get("website") as string) || null,
      address: (formData.get("address") as string) || null,
      rating: formData.get("rating") ? parseInt(formData.get("rating") as string) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/providers");
  revalidatePath("/repairs");
  revalidatePath("/dashboard");
}

export async function updateProviderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.serviceProvider.update({
    where: { id, householdId },
    data: {
      name: (formData.get("name") as string).trim(),
      company: (formData.get("company") as string) || null,
      specialty: (formData.get("specialty") as ProviderSpecialty) || "OTHER",
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      website: (formData.get("website") as string) || null,
      address: (formData.get("address") as string) || null,
      rating: formData.get("rating") ? parseInt(formData.get("rating") as string) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/providers");
  revalidatePath("/repairs");
}

export async function deleteProviderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.serviceProvider.delete({
    where: { id, householdId },
  });

  revalidatePath("/providers");
  revalidatePath("/repairs");
  revalidatePath("/dashboard");
}
