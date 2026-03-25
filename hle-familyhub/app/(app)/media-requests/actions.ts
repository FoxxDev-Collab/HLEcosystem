"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { MediaType, RequestStatus } from "@prisma/client";

const VALID_MEDIA_TYPES: MediaType[] = ["MOVIE", "TV_SHOW", "MUSIC"];
const VALID_STATUSES: RequestStatus[] = ["REQUESTED", "COMPLETED"];

export async function createMediaRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const title = (formData.get("title") as string)?.trim();
  const mediaType = formData.get("mediaType") as MediaType;
  if (!title || !VALID_MEDIA_TYPES.includes(mediaType)) return;

  const artist = (formData.get("artist") as string)?.trim() || null;
  const yearStr = formData.get("year") as string;
  const year = yearStr ? parseInt(yearStr) : null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  await prisma.mediaRequest.create({
    data: {
      requesterId: user.id,
      mediaType,
      title,
      artist,
      year,
      notes,
    },
  });

  revalidatePath("/media-requests");
}

export async function updateRequestStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const id = formData.get("id") as string;
  const status = formData.get("status") as RequestStatus;
  if (!id || !VALID_STATUSES.includes(status)) return;

  await prisma.mediaRequest.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/media-requests");
}

export async function addCommentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const requestId = formData.get("requestId") as string;
  const message = (formData.get("message") as string)?.trim();
  if (!requestId || !message) return;

  await prisma.mediaRequestComment.create({
    data: {
      requestId,
      userId: user.id,
      message,
    },
  });

  revalidatePath("/media-requests");
}

export async function deleteMediaRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const id = formData.get("id") as string;
  if (!id) return;

  const request = await prisma.mediaRequest.findUnique({ where: { id } });
  if (!request) return;
  if (request.requesterId !== user.id && user.role !== "ADMIN") return;

  await prisma.mediaRequest.delete({ where: { id } });

  revalidatePath("/media-requests");
}
