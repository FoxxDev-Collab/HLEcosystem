"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createStoreAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  if (!name?.trim()) return;

  await prisma.store.create({
    data: {
      householdId,
      name: name.trim(),
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
      color: (formData.get("color") as string) || null,
    },
  });

  revalidatePath("/stores");
}

export async function updateStoreAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.store.updateMany({
    where: { id, householdId },
    data: {
      name: (formData.get("name") as string) || undefined,
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
      color: (formData.get("color") as string) || null,
    },
  });

  revalidatePath("/stores");
}

export async function deleteStoreAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.store.deleteMany({ where: { id, householdId } });
  revalidatePath("/stores");
}
