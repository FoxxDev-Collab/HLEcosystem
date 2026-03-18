"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createRoomAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string) || null;
  const floor = (formData.get("floor") as string) || null;

  if (!name) return;

  await prisma.room.create({
    data: { householdId, name, description, floor },
  });

  revalidatePath("/rooms");
  revalidatePath("/items");
  revalidatePath("/dashboard");
}

export async function updateRoomAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string) || null;
  const floor = (formData.get("floor") as string) || null;

  if (!name) return;

  await prisma.room.update({
    where: { id, householdId },
    data: { name, description, floor },
  });

  revalidatePath("/rooms");
  revalidatePath("/items");
}

export async function deleteRoomAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.room.delete({
    where: { id, householdId },
  });

  revalidatePath("/rooms");
  revalidatePath("/items");
  revalidatePath("/dashboard");
}
