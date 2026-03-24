"use server";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTagAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = (formData.get("name") as string)?.trim();
  const color = (formData.get("color") as string) || null;

  if (!name) return;

  const existing = await prisma.tag.findFirst({
    where: { householdId, name },
  });
  if (existing) return;

  await prisma.tag.create({
    data: { householdId, name, color },
  });

  revalidatePath("/tags");
}

export async function deleteTagAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const tagId = formData.get("tagId") as string;
  if (!tagId) return;

  await prisma.tag.deleteMany({
    where: { id: tagId, householdId },
  });

  revalidatePath("/tags");
}

export async function updateTagAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const tagId = formData.get("tagId") as string;
  const name = (formData.get("name") as string)?.trim();
  const color = (formData.get("color") as string) || null;

  if (!tagId || !name) return;

  const tag = await prisma.tag.findFirst({
    where: { id: tagId, householdId },
  });
  if (!tag) return;

  await prisma.tag.update({
    where: { id: tagId },
    data: { name, color },
  });

  revalidatePath("/tags");
}

export async function addTagToFileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  const tagId = formData.get("tagId") as string;

  if (!fileId || !tagId) return;

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId },
  });
  if (!file) return;

  const tag = await prisma.tag.findFirst({
    where: { id: tagId, householdId },
  });
  if (!tag) return;

  await prisma.fileTag.create({
    data: { fileId, tagId },
  });

  revalidatePath("/tags");
  revalidatePath("/browse");
}

export async function removeTagFromFileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileTagId = formData.get("fileTagId") as string;
  if (!fileTagId) return;

  await prisma.fileTag.delete({
    where: { id: fileTagId },
  });

  revalidatePath("/tags");
  revalidatePath("/browse");
}

export async function removeTagByIdsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  const tagId = formData.get("tagId") as string;
  if (!fileId || !tagId) return;

  await prisma.fileTag.deleteMany({
    where: { fileId, tagId, file: { householdId } },
  });

  revalidatePath("/tags");
  revalidatePath("/browse");
}
