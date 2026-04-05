"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function moveToHouseholdAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  if (!fileId) return;

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, ownerId: user.id, deletedAt: null },
  });
  if (!file) return;

  // Clear ownerId to make it a household file, move to root
  await prisma.file.update({
    where: { id: fileId },
    data: { ownerId: null, folderId: null },
  });

  revalidatePath("/browse");
  revalidatePath("/my-files");
  revalidatePath("/dashboard");
  redirect("/browse");
}
