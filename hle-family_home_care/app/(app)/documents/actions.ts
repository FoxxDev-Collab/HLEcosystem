"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { deleteFileFromDisk } from "@/lib/file-storage";
import type { DocumentType } from "@prisma/client";

export async function updateDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  const doc = await prisma.document.findFirst({ where: { id, householdId } });
  if (!doc) return;

  const name = formData.get("name") as string;
  const type = formData.get("type") as DocumentType;
  const notes = formData.get("notes") as string;
  const rawItemId = formData.get("itemId") as string;
  const rawVehicleId = formData.get("vehicleId") as string;
  const rawRepairId = formData.get("repairId") as string;
  const itemId = rawItemId && rawItemId !== "_none" ? rawItemId : null;
  const vehicleId = rawVehicleId && rawVehicleId !== "_none" ? rawVehicleId : null;
  const repairId = rawRepairId && rawRepairId !== "_none" ? rawRepairId : null;

  await prisma.document.update({
    where: { id },
    data: {
      name: name || doc.name,
      type: type || doc.type,
      notes: notes || null,
      itemId,
      vehicleId,
      repairId,
    },
  });

  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
  if (doc.itemId) revalidatePath(`/items/${doc.itemId}`);
  if (itemId) revalidatePath(`/items/${itemId}`);
  if (doc.vehicleId) revalidatePath(`/vehicles/${doc.vehicleId}`);
  if (vehicleId) revalidatePath(`/vehicles/${vehicleId}`);
}

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

  const otherRefs = await prisma.document.count({
    where: { contentHash: doc.contentHash, id: { not: id } },
  });

  if (otherRefs === 0) {
    await deleteFileFromDisk(doc.storagePath);
  }

  await prisma.document.delete({ where: { id } });

  revalidatePath("/documents");
  if (doc.itemId) revalidatePath(`/items/${doc.itemId}`);
  if (doc.vehicleId) revalidatePath(`/vehicles/${doc.vehicleId}`);

  redirect("/documents");
}
