"use server";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function shareFileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  const sharedWithUserId = formData.get("sharedWithUserId") as string;
  const permission = (formData.get("permission") as string) || "VIEW";

  if (!fileId || !sharedWithUserId) return;
  if (!["VIEW", "DOWNLOAD", "EDIT"].includes(permission)) return;

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId },
  });
  if (!file) return;

  await prisma.fileShare.create({
    data: {
      fileId,
      sharedWithUserId,
      sharedByUserId: user.id,
      permission: permission as "VIEW" | "DOWNLOAD" | "EDIT",
    },
  });

  revalidatePath("/shared");
}

export async function removeShareAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const shareId = formData.get("shareId") as string;
  if (!shareId) return;

  const share = await prisma.fileShare.findFirst({
    where: { id: shareId },
    include: { file: true },
  });
  if (!share || share.file.householdId !== householdId) return;

  await prisma.fileShare.delete({ where: { id: shareId } });

  revalidatePath("/shared");
}

export async function createShareLinkAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  const permission = (formData.get("permission") as string) || "VIEW";
  const expiresAtStr = formData.get("expiresAt") as string | null;
  const maxDownloadsStr = formData.get("maxDownloads") as string | null;

  if (!fileId) return;
  if (!["VIEW", "DOWNLOAD", "EDIT"].includes(permission)) return;

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId },
  });
  if (!file) return;

  const shareLink = await prisma.shareLink.create({
    data: {
      fileId,
      permission: permission as "VIEW" | "DOWNLOAD" | "EDIT",
      createdByUserId: user.id,
      expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
      maxDownloads: maxDownloadsStr ? parseInt(maxDownloadsStr, 10) : null,
    },
  });

  revalidatePath("/shared");
  return { token: shareLink.token };
}

export async function revokeShareLinkAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const shareLinkId = formData.get("shareLinkId") as string;
  if (!shareLinkId) return;

  const shareLink = await prisma.shareLink.findFirst({
    where: { id: shareLinkId },
    include: { file: true },
  });
  if (!shareLink || shareLink.file.householdId !== householdId) return;

  await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: { isActive: false },
  });

  revalidatePath("/shared");
}
