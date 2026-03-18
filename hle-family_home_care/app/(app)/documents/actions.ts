"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { deleteFileFromDisk } from "@/lib/file-storage";

export async function deleteDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  const doc = await prisma.document.findFirst({
    where: { id, householdId },
  });

  if (!doc) return;

  // Check if other documents share the same file (content-addressed dedup)
  const otherRefs = await prisma.document.count({
    where: { contentHash: doc.contentHash, id: { not: id } },
  });

  // Only delete from disk if no other documents reference this file
  if (otherRefs === 0) {
    await deleteFileFromDisk(doc.storagePath);
  }

  await prisma.document.delete({ where: { id } });

  revalidatePath("/documents");
  if (doc.itemId) revalidatePath(`/items/${doc.itemId}`);
  if (doc.vehicleId) revalidatePath(`/vehicles/${doc.vehicleId}`);
}
