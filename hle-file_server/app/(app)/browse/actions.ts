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

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, householdId },
    select: { isSystem: true },
  });
  if (folder?.isSystem) return; // system folders cannot be renamed

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
  if (folder.isSystem) return; // system folders cannot be deleted

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

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, householdId },
    select: { isSystem: true },
  });
  if (folder?.isSystem) return; // system folders stay at root

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

export async function bulkMoveFilesAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileIdsJson = formData.get("fileIds") as string;
  const folderIdsJson = formData.get("folderIds") as string;
  const targetFolderId = (formData.get("targetFolderId") as string) || null;
  const fileIds: string[] = JSON.parse(fileIdsJson || "[]");
  const folderIds: string[] = JSON.parse(folderIdsJson || "[]");

  if (fileIds.length > 0) {
    await prisma.file.updateMany({
      where: { id: { in: fileIds }, householdId },
      data: { folderId: targetFolderId },
    });
  }

  if (folderIds.length > 0) {
    // Exclude system folders from being moved
    await prisma.folder.updateMany({
      where: { id: { in: folderIds }, householdId, isSystem: false },
      data: { parentFolderId: targetFolderId },
    });
  }

  revalidateAll();
}

export async function bulkFavoriteFilesAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileIdsJson = formData.get("fileIds") as string;
  const fileIds: string[] = JSON.parse(fileIdsJson || "[]");

  for (const fileId of fileIds) {
    const existing = await prisma.favorite.findUnique({
      where: { userId_fileId: { userId: user.id, fileId } },
    });
    if (!existing) {
      await prisma.favorite.create({ data: { userId: user.id, fileId } });
    }
  }

  revalidateAll();
}

export async function bulkDeleteFoldersAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const folderIdsJson = formData.get("folderIds") as string;
  const folderIds: string[] = JSON.parse(folderIdsJson || "[]");
  const now = new Date();

  // Exclude system folders from deletion
  await prisma.folder.updateMany({
    where: { id: { in: folderIds }, householdId, isSystem: false },
    data: { deletedAt: now },
  });

  await prisma.file.updateMany({
    where: { folderId: { in: folderIds }, householdId },
    data: { deletedAt: now, status: "DELETED" },
  });

  revalidateAll();
}

export async function copyFileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  const targetFolderId = (formData.get("targetFolderId") as string) || null;

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId },
    include: { tags: true },
  });
  if (!file) return;

  // Create a copy — same storage path (content-addressed dedup), new DB record
  const copy = await prisma.file.create({
    data: {
      householdId,
      folderId: targetFolderId,
      ownerId: file.ownerId,
      name: `${file.name.replace(/(\.[^.]+)$/, "")} (copy)${file.name.match(/(\.[^.]+)$/)?.[1] ?? ""}`,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      storagePath: file.storagePath,
      contentHash: file.contentHash,
      thumbnailPath: file.thumbnailPath,
      uploadedByUserId: user.id,
    },
  });

  // Copy tags
  if (file.tags.length > 0) {
    await prisma.fileTag.createMany({
      data: file.tags.map((t) => ({ fileId: copy.id, tagId: t.tagId })),
    });
  }

  // Create version 1 for the copy
  await prisma.fileVersion.create({
    data: {
      fileId: copy.id,
      versionNumber: 1,
      size: file.size,
      storagePath: file.storagePath,
      contentHash: file.contentHash,
      uploadedByUserId: user.id,
    },
  });

  // Update storage quota (logical copy still counts toward quota)
  await prisma.storageQuota.upsert({
    where: { householdId },
    create: { householdId, usedStorageBytes: file.size },
    update: { usedStorageBytes: { increment: file.size } },
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
