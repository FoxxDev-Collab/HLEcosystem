"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

function revalidateAll() {
  revalidatePath("/browse");
  revalidatePath("/my-files");
  revalidatePath("/dashboard");
  revalidatePath("/favorites");
}

// ============================================================================
// FOLDER ACTIONS
// ============================================================================

export async function createFolderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const parentFolderId = (formData.get("parentFolderId") as string) || null;
  const color = (formData.get("color") as string) || null;
  const isPersonal = formData.get("isPersonal") === "true";

  await prisma.folder.create({
    data: {
      householdId,
      parentFolderId,
      ownerId: isPersonal ? user.id : null,
      name,
      color,
      createdByUserId: user.id,
    },
  });

  revalidateAll();
}

export async function renameFolderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const folderId = formData.get("folderId") as string;
  const name = formData.get("name") as string;

  await prisma.folder.update({
    where: { id: folderId, householdId },
    data: { name },
  });

  revalidateAll();
}

export async function deleteFolderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const folderId = formData.get("folderId") as string;

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, householdId },
  });

  if (!folder) return;

  const now = new Date();

  await prisma.folder.update({
    where: { id: folderId, householdId },
    data: { deletedAt: now },
  });

  await prisma.file.updateMany({
    where: { folderId, householdId },
    data: { deletedAt: now, status: "DELETED" },
  });

  revalidateAll();
}

export async function moveFolderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const folderId = formData.get("folderId") as string;
  const targetParentFolderId = formData.get("targetParentFolderId") as string;

  await prisma.folder.update({
    where: { id: folderId, householdId },
    data: {
      parentFolderId: targetParentFolderId || null,
    },
  });

  revalidateAll();
}

// ============================================================================
// FILE ACTIONS
// ============================================================================

export async function renameFileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  const name = formData.get("name") as string;

  await prisma.file.update({
    where: { id: fileId, householdId },
    data: { name },
  });

  revalidateAll();
}

export async function moveFileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  const targetFolderId = formData.get("targetFolderId") as string;

  await prisma.file.update({
    where: { id: fileId, householdId },
    data: {
      folderId: targetFolderId || null,
    },
  });

  revalidateAll();
}

export async function deleteFileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;

  await prisma.file.update({
    where: { id: fileId, householdId },
    data: {
      deletedAt: new Date(),
      status: "DELETED",
    },
  });

  revalidateAll();
}

export async function deleteFilesAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileIdsJson = formData.get("fileIds") as string;
  const fileIds: string[] = JSON.parse(fileIdsJson);

  await prisma.file.updateMany({
    where: {
      id: { in: fileIds },
      householdId,
    },
    data: {
      deletedAt: new Date(),
      status: "DELETED",
    },
  });

  revalidateAll();
}

export async function updateFileDescriptionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  const description = (formData.get("description") as string) || null;

  await prisma.file.update({
    where: { id: fileId, householdId },
    data: { description },
  });

  revalidateAll();
}
