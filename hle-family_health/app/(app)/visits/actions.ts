"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { VisitType } from "@prisma/client";

export async function createVisitSummaryAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyMemberId = formData.get("familyMemberId") as string;

  // Verify familyMember belongs to household
  const member = await prisma.familyMember.findFirst({ where: { id: familyMemberId, householdId } });
  if (!member) return;

  await prisma.visitSummary.create({
    data: {
      familyMemberId,
      providerId: formData.get("providerId") as string || null,
      visitDate: new Date(formData.get("visitDate") as string),
      visitType: formData.get("visitType") as VisitType || "IN_PERSON",
      chiefComplaint: formData.get("chiefComplaint") as string || null,
      diagnosis: formData.get("diagnosis") as string || null,
      treatmentProvided: formData.get("treatmentProvided") as string || null,
      prescriptionsWritten: formData.get("prescriptionsWritten") as string || null,
      labTestsOrdered: formData.get("labTestsOrdered") as string || null,
      followUpInstructions: formData.get("followUpInstructions") as string || null,
      notes: formData.get("notes") as string || null,
      billedAmount: formData.get("billedAmount") ? parseFloat(formData.get("billedAmount") as string) : null,
      insurancePaid: formData.get("insurancePaid") ? parseFloat(formData.get("insurancePaid") as string) : null,
      outOfPocketCost: formData.get("outOfPocketCost") ? parseFloat(formData.get("outOfPocketCost") as string) : null,
      paidFromHsa: formData.get("paidFromHsa") === "on",
    },
  });

  revalidatePath("/visits");
  revalidatePath("/dashboard");
}

export async function deleteVisitSummaryAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const record = await prisma.visitSummary.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!record) return;

  await prisma.visitSummary.delete({ where: { id } });
  revalidatePath("/visits");
}
