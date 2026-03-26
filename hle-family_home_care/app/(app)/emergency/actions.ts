"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type {
  EmergencyContactType,
  EmergencyPlanType,
  SupplyCondition,
} from "@prisma/client";

// ─── Emergency Contacts ──────────────────────────────────────

export async function createEmergencyContactAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  await prisma.emergencyContact.create({
    data: {
      householdId,
      name,
      type: (formData.get("type") as EmergencyContactType) || "OTHER",
      company: (formData.get("company") as string) || null,
      phone: (formData.get("phone") as string) || null,
      phoneAlt: (formData.get("phoneAlt") as string) || null,
      email: (formData.get("email") as string) || null,
      address: (formData.get("address") as string) || null,
      accountNumber: (formData.get("accountNumber") as string) || null,
      availableHours: (formData.get("availableHours") as string) || null,
      priority: formData.get("priority") ? parseInt(formData.get("priority") as string) : 0,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function updateEmergencyContactAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.emergencyContact.update({
    where: { id, householdId },
    data: {
      name: (formData.get("name") as string)?.trim(),
      type: (formData.get("type") as EmergencyContactType) || "OTHER",
      company: (formData.get("company") as string) || null,
      phone: (formData.get("phone") as string) || null,
      phoneAlt: (formData.get("phoneAlt") as string) || null,
      email: (formData.get("email") as string) || null,
      address: (formData.get("address") as string) || null,
      accountNumber: (formData.get("accountNumber") as string) || null,
      availableHours: (formData.get("availableHours") as string) || null,
      priority: formData.get("priority") ? parseInt(formData.get("priority") as string) : 0,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function deleteEmergencyContactAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.emergencyContact.delete({
    where: { id, householdId },
  });

  revalidatePath("/emergency");
}

// ─── Emergency Plans ─────────────────────────────────────────

export async function createEmergencyPlanAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const title = (formData.get("title") as string)?.trim();
  const type = formData.get("type") as EmergencyPlanType;
  if (!title || !type) return;

  await prisma.emergencyPlan.create({
    data: {
      householdId,
      type,
      title,
      description: (formData.get("description") as string) || null,
      meetingPoint: (formData.get("meetingPoint") as string) || null,
      evacuationRoute: (formData.get("evacuationRoute") as string) || null,
      procedures: (formData.get("procedures") as string) || null,
      reviewFrequencyMonths: formData.get("reviewFrequencyMonths")
        ? parseInt(formData.get("reviewFrequencyMonths") as string)
        : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function updateEmergencyPlanAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.emergencyPlan.update({
    where: { id, householdId },
    data: {
      type: (formData.get("type") as EmergencyPlanType) || "CUSTOM",
      title: (formData.get("title") as string)?.trim(),
      description: (formData.get("description") as string) || null,
      meetingPoint: (formData.get("meetingPoint") as string) || null,
      evacuationRoute: (formData.get("evacuationRoute") as string) || null,
      procedures: (formData.get("procedures") as string) || null,
      reviewFrequencyMonths: formData.get("reviewFrequencyMonths")
        ? parseInt(formData.get("reviewFrequencyMonths") as string)
        : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function deleteEmergencyPlanAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.emergencyPlan.delete({
    where: { id, householdId },
  });

  revalidatePath("/emergency");
}

export async function markPlanReviewedAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.emergencyPlan.update({
    where: { id, householdId },
    data: { lastReviewed: new Date() },
  });

  revalidatePath("/emergency");
}

// ─── Supply Kits ─────────────────────────────────────────────

export async function createSupplyKitAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  await prisma.emergencySupplyKit.create({
    data: {
      householdId,
      name,
      location: (formData.get("location") as string) || null,
      roomId: (formData.get("roomId") as string) || null,
      description: (formData.get("description") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function updateSupplyKitAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.emergencySupplyKit.update({
    where: { id, householdId },
    data: {
      name: (formData.get("name") as string)?.trim(),
      location: (formData.get("location") as string) || null,
      roomId: (formData.get("roomId") as string) || null,
      description: (formData.get("description") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function deleteSupplyKitAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.emergencySupplyKit.delete({
    where: { id, householdId },
  });

  revalidatePath("/emergency");
}

export async function markKitCheckedAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.emergencySupplyKit.update({
    where: { id, householdId },
    data: { lastChecked: new Date() },
  });

  revalidatePath("/emergency");
}

// ─── Supply Items ────────────────────────────────────────────

export async function addSupplyItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const kitId = formData.get("kitId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!kitId || !name) return;

  // Verify kit belongs to household
  const kit = await prisma.emergencySupplyKit.findFirst({
    where: { id: kitId, householdId },
  });
  if (!kit) return;

  await prisma.emergencySupply.create({
    data: {
      kitId,
      name,
      quantity: formData.get("quantity") ? parseInt(formData.get("quantity") as string) : 1,
      unit: (formData.get("unit") as string) || null,
      expirationDate: formData.get("expirationDate")
        ? new Date(formData.get("expirationDate") as string)
        : null,
      condition: (formData.get("condition") as SupplyCondition) || "GOOD",
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function updateSupplyItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  // Verify item's kit belongs to household
  const item = await prisma.emergencySupply.findUnique({
    where: { id },
    include: { kit: true },
  });
  if (!item || item.kit.householdId !== householdId) return;

  await prisma.emergencySupply.update({
    where: { id },
    data: {
      name: (formData.get("name") as string)?.trim(),
      quantity: formData.get("quantity") ? parseInt(formData.get("quantity") as string) : 1,
      unit: (formData.get("unit") as string) || null,
      expirationDate: formData.get("expirationDate")
        ? new Date(formData.get("expirationDate") as string)
        : null,
      condition: (formData.get("condition") as SupplyCondition) || "GOOD",
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function deleteSupplyItemAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  // Verify item's kit belongs to household
  const item = await prisma.emergencySupply.findUnique({
    where: { id },
    include: { kit: true },
  });
  if (!item || item.kit.householdId !== householdId) return;

  await prisma.emergencySupply.delete({
    where: { id },
  });

  revalidatePath("/emergency");
}

// ─── Utility Shutoffs ────────────────────────────────────────

export async function createUtilityShutoffAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const utilityType = (formData.get("utilityType") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();
  if (!utilityType || !location) return;

  await prisma.utilityShutoff.create({
    data: {
      householdId,
      utilityType,
      location,
      roomId: (formData.get("roomId") as string) || null,
      procedure: (formData.get("procedure") as string) || null,
      toolsNeeded: (formData.get("toolsNeeded") as string) || null,
      photoUrl: (formData.get("photoUrl") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function updateUtilityShutoffAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.utilityShutoff.update({
    where: { id, householdId },
    data: {
      utilityType: (formData.get("utilityType") as string)?.trim(),
      location: (formData.get("location") as string)?.trim(),
      roomId: (formData.get("roomId") as string) || null,
      procedure: (formData.get("procedure") as string) || null,
      toolsNeeded: (formData.get("toolsNeeded") as string) || null,
      photoUrl: (formData.get("photoUrl") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function deleteUtilityShutoffAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.utilityShutoff.delete({
    where: { id, householdId },
  });

  revalidatePath("/emergency");
}

// ─── Important Document Locations ────────────────────────────

export async function createDocumentLocationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const documentName = (formData.get("documentName") as string)?.trim();
  if (!documentName) return;

  await prisma.importantDocumentLocation.create({
    data: {
      householdId,
      documentName,
      category: (formData.get("category") as string) || null,
      physicalLocation: (formData.get("physicalLocation") as string) || null,
      digitalLocation: (formData.get("digitalLocation") as string) || null,
      accountNumber: (formData.get("accountNumber") as string) || null,
      policyNumber: (formData.get("policyNumber") as string) || null,
      expirationDate: formData.get("expirationDate")
        ? new Date(formData.get("expirationDate") as string)
        : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function updateDocumentLocationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.importantDocumentLocation.update({
    where: { id, householdId },
    data: {
      documentName: (formData.get("documentName") as string)?.trim(),
      category: (formData.get("category") as string) || null,
      physicalLocation: (formData.get("physicalLocation") as string) || null,
      digitalLocation: (formData.get("digitalLocation") as string) || null,
      accountNumber: (formData.get("accountNumber") as string) || null,
      policyNumber: (formData.get("policyNumber") as string) || null,
      expirationDate: formData.get("expirationDate")
        ? new Date(formData.get("expirationDate") as string)
        : null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/emergency");
}

export async function deleteDocumentLocationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  await prisma.importantDocumentLocation.delete({
    where: { id, householdId },
  });

  revalidatePath("/emergency");
}
