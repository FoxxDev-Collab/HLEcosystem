"use server";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function toggleFavoriteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  if (!fileId) return;

  // Verify file access
  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, status: "ACTIVE", deletedAt: null },
  });
  if (!file) return;

  // Toggle: if exists delete, if not create
  const existing = await prisma.favorite.findUnique({
    where: { userId_fileId: { userId: user.id, fileId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.favorite.create({ data: { userId: user.id, fileId } });
  }

  revalidatePath("/favorites");
  revalidatePath("/browse");
  revalidatePath("/my-files");
  revalidatePath(`/browse/${fileId}`);
  revalidatePath(`/my-files/${fileId}`);
}
