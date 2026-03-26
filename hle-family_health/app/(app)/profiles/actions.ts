"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { BloodType } from "@prisma/client";

export async function createHealthProfileRecordAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyMemberId = formData.get("familyMemberId") as string;

  const member = await prisma.familyMember.findFirst({ where: { id: familyMemberId, householdId } });
  if (!member) return;

  const bloodType = (formData.get("bloodType") as BloodType) || "UNKNOWN";
  const heightCm = formData.get("heightCm") ? parseFloat(formData.get("heightCm") as string) : null;
  const weightKg = formData.get("weightKg") ? parseFloat(formData.get("weightKg") as string) : null;
  const primaryCareProvider = (formData.get("primaryCareProvider") as string) || null;
  const preferredHospital = (formData.get("preferredHospital") as string) || null;
  const medicalNotes = (formData.get("medicalNotes") as string) || null;
  const isOrganDonor = formData.get("isOrganDonor") === "on";

  const allergies = ((formData.get("allergies") as string) || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const chronicConditions = ((formData.get("chronicConditions") as string) || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const majorSurgeries = ((formData.get("majorSurgeries") as string) || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const recordDateStr = formData.get("recordDate") as string;
  const recordDate = recordDateStr ? new Date(recordDateStr) : new Date();

  await prisma.healthProfileRecord.create({
    data: {
      familyMemberId,
      recordDate,
      bloodType,
      heightCm,
      weightKg,
      allergies,
      chronicConditions,
      majorSurgeries,
      primaryCareProvider,
      preferredHospital,
      medicalNotes,
      isOrganDonor,
    },
  });

  revalidatePath("/profiles");
  revalidatePath(`/family/${familyMemberId}`);
  revalidatePath("/dashboard");
}

export async function deleteHealthProfileRecordAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const record = await prisma.healthProfileRecord.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!record) return;

  await prisma.healthProfileRecord.delete({ where: { id } });

  revalidatePath("/profiles");
  revalidatePath(`/family/${record.familyMemberId}`);
  revalidatePath("/dashboard");
}
