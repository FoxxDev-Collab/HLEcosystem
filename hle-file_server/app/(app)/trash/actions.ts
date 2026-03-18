"use server";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { deleteFileFromDisk } from "@/lib/file-storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function revalidateAll() {
  revalidatePath("/trash");
  revalidatePath("/browse");
  revalidatePath("/my-files");
  revalidatePath("/dashboard");
  revalidatePath("/favorites");
}

export async function restoreFileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  if (!fileId) return;

  await prisma.file.update({
    where: { id: fileId, householdId },
    data: { deletedAt: null, status: "ACTIVE" },
  });

  revalidateAll();
}

export async function restoreFolderAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const folderId = formData.get("folderId") as string;
  if (!folderId) return;

  // Restore the folder
  await prisma.folder.update({
    where: { id: folderId, householdId },
    data: { deletedAt: null },
  });

  // Also restore files that were in this folder
  await prisma.file.updateMany({
    where: { folderId, householdId, status: "DELETED" },
    data: { deletedAt: null, status: "ACTIVE" },
  });

  revalidateAll();
}

export async function permanentDeleteFileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  if (!fileId) return;

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId },
  });
  if (!file) return;

  const fileSize = file.size;
  const storagePath = file.storagePath;

  // Delete the file record from the database (cascades to favorites, tags, etc.)
  await prisma.file.delete({
    where: { id: fileId },
  });

  // Delete file from disk
  await deleteFileFromDisk(storagePath);

  // Decrement storage quota
  await prisma.storageQuota.updateMany({
    where: { householdId },
    data: {
      usedStorageBytes: {
        decrement: fileSize,
      },
    },
  });

  revalidateAll();
}

export async function emptyTrashAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  // Get all trashed files to delete from disk and calculate size
  const trashedFiles = await prisma.file.findMany({
    where: {
      householdId,
      status: "DELETED",
      deletedAt: { not: null },
    },
    select: { id: true, storagePath: true, size: true },
  });

  // Calculate total size to free
  let totalSize = BigInt(0);
  for (const file of trashedFiles) {
    totalSize += file.size;
  }

  // Delete all trashed files from DB (cascades to favorites, tags, etc.)
  await prisma.file.deleteMany({
    where: {
      householdId,
      status: "DELETED",
      deletedAt: { not: null },
    },
  });

  // Delete all trashed folders from DB
  await prisma.folder.deleteMany({
    where: {
      householdId,
      deletedAt: { not: null },
    },
  });

  // Delete files from disk
  for (const file of trashedFiles) {
    await deleteFileFromDisk(file.storagePath);
  }

  // Decrement storage quota
  if (totalSize > BigInt(0)) {
    await prisma.storageQuota.updateMany({
      where: { householdId },
      data: {
        usedStorageBytes: {
          decrement: totalSize,
        },
      },
    });
  }

  revalidateAll();
}
