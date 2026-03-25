"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { BloodType } from "@prisma/client";

export async function upsertHealthProfileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyMemberId = formData.get("familyMemberId") as string;

  // Verify familyMember belongs to household
  const member = await prisma.familyMember.findFirst({ where: { id: familyMemberId, householdId } });
  if (!member) return;

  const bloodType = formData.get("bloodType") as BloodType || "UNKNOWN";
  const heightCm = formData.get("heightCm") ? parseFloat(formData.get("heightCm") as string) : null;
  const weightKg = formData.get("weightKg") ? parseFloat(formData.get("weightKg") as string) : null;
  const primaryCareProvider = formData.get("primaryCareProvider") as string || null;
  const preferredHospital = formData.get("preferredHospital") as string || null;
  const medicalNotes = formData.get("medicalNotes") as string || null;
  const isOrganDonor = formData.get("isOrganDonor") === "on";

  // Parse comma-separated arrays
  const allergies = (formData.get("allergies") as string || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const chronicConditions = (formData.get("chronicConditions") as string || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const majorSurgeries = (formData.get("majorSurgeries") as string || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const data = {
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
  };

  await prisma.healthProfile.upsert({
    where: { familyMemberId },
    update: data,
    create: { familyMemberId, ...data },
  });

  revalidatePath("/profiles");
  revalidatePath(`/family/${familyMemberId}`);
  revalidatePath("/dashboard");
}
