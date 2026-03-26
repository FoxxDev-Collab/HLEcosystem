"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import type { TravelDocumentType } from "@prisma/client";

export async function createDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const type = formData.get("type") as TravelDocumentType;
  const documentNumber = (formData.get("documentNumber") as string) || null;
  const issuingCountry = (formData.get("issuingCountry") as string) || null;
  const issueDate = formData.get("issueDate") as string;
  const expiryDate = formData.get("expiryDate") as string;
  const householdMemberId = (formData.get("householdMemberId") as string) || null;
  const displayName = (formData.get("displayName") as string) || null;
  const tripId = (formData.get("tripId") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!type) return { error: "Document type is required" };

  try {
    await prisma.travelDocument.create({
      data: {
        householdId,
        type,
        documentNumber,
        issuingCountry,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        householdMemberId,
        displayName,
        tripId,
        notes,
      },
    });
    revalidatePath("/documents");
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to create document" };
  }
}

export async function updateDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const documentId = formData.get("documentId") as string;
  const type = formData.get("type") as TravelDocumentType;
  const documentNumber = (formData.get("documentNumber") as string) || null;
  const issuingCountry = (formData.get("issuingCountry") as string) || null;
  const issueDate = formData.get("issueDate") as string;
  const expiryDate = formData.get("expiryDate") as string;
  const householdMemberId = (formData.get("householdMemberId") as string) || null;
  const displayName = (formData.get("displayName") as string) || null;
  const tripId = (formData.get("tripId") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!documentId || !type) return { error: "Missing required fields" };

  const doc = await prisma.travelDocument.findFirst({
    where: { id: documentId, householdId },
  });
  if (!doc) return { error: "Document not found" };

  try {
    await prisma.travelDocument.update({
      where: { id: documentId },
      data: {
        type,
        documentNumber,
        issuingCountry,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        householdMemberId,
        displayName,
        tripId,
        notes,
      },
    });
    revalidatePath("/documents");
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to update document" };
  }
}

export async function deleteDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const documentId = formData.get("documentId") as string;
  if (!documentId) return { error: "Document ID required" };

  const doc = await prisma.travelDocument.findFirst({
    where: { id: documentId, householdId },
  });
  if (!doc) return { error: "Document not found" };

  try {
    await prisma.travelDocument.delete({ where: { id: documentId } });
    revalidatePath("/documents");
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to delete document" };
  }
}
