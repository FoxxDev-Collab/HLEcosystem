"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createAlbumAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;

  if (!name?.trim()) return { error: "Album name is required" };

  const existing = await prisma.album.findUnique({
    where: { householdId_name: { householdId, name: name.trim() } },
  });
  if (existing) return { error: "An album with that name already exists" };

  const album = await prisma.album.create({
    data: {
      householdId,
      name: name.trim(),
      description,
      createdByUserId: user.id,
    },
  });

  revalidatePath("/albums");
  return { albumId: album.id };
}

export async function updateAlbumAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const albumId = formData.get("albumId") as string;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;

  if (!albumId || !name?.trim()) return { error: "Album ID and name are required" };

  await prisma.album.update({
    where: { id: albumId, householdId },
    data: { name: name.trim(), description },
  });

  revalidatePath("/albums");
  revalidatePath(`/albums/${albumId}`);
}

export async function deleteAlbumAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const albumId = formData.get("albumId") as string;
  if (!albumId) return;

  await prisma.album.delete({
    where: { id: albumId, householdId },
  });

  revalidatePath("/albums");
  redirect("/albums");
}

export async function addFilesToAlbumAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const albumId = formData.get("albumId") as string;
  const fileIdsJson = formData.get("fileIds") as string;
  if (!albumId || !fileIdsJson) return;

  const fileIds: string[] = JSON.parse(fileIdsJson);

  // Verify album belongs to household
  const album = await prisma.album.findFirst({
    where: { id: albumId, householdId },
  });
  if (!album) return { error: "Album not found" };

  // Get current max sort order
  const maxSort = await prisma.albumFile.aggregate({
    where: { albumId },
    _max: { sortOrder: true },
  });
  let nextSort = (maxSort._max.sortOrder ?? 0) + 1;

  // Add files, skipping duplicates
  for (const fileId of fileIds) {
    const exists = await prisma.albumFile.findUnique({
      where: { albumId_fileId: { albumId, fileId } },
    });
    if (!exists) {
      await prisma.albumFile.create({
        data: { albumId, fileId, sortOrder: nextSort++ },
      });
    }
  }

  // Set cover if album has none
  if (!album.coverFileId && fileIds.length > 0) {
    await prisma.album.update({
      where: { id: albumId },
      data: { coverFileId: fileIds[0] },
    });
  }

  revalidatePath(`/albums/${albumId}`);
  revalidatePath("/albums");
}

export async function removeFileFromAlbumAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const albumId = formData.get("albumId") as string;
  const fileId = formData.get("fileId") as string;
  if (!albumId || !fileId) return;

  await prisma.albumFile.delete({
    where: { albumId_fileId: { albumId, fileId } },
  });

  revalidatePath(`/albums/${albumId}`);
  revalidatePath("/albums");
}

export async function setAlbumCoverAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const albumId = formData.get("albumId") as string;
  const fileId = formData.get("fileId") as string;
  if (!albumId || !fileId) return;

  await prisma.album.update({
    where: { id: albumId, householdId },
    data: { coverFileId: fileId },
  });

  revalidatePath(`/albums/${albumId}`);
  revalidatePath("/albums");
}
