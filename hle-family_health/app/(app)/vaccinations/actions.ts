"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createVaccinationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyMemberId = formData.get("familyMemberId") as string;

  // Verify familyMember belongs to household
  const member = await prisma.familyMember.findFirst({ where: { id: familyMemberId, householdId } });
  if (!member) return;

  const vaccineName = formData.get("vaccineName") as string;
  const doseNumber = formData.get("doseNumber") as string || null;
  const dateAdministered = formData.get("dateAdministered") as string;
  const nextDoseDate = formData.get("nextDoseDate") as string;
  const administeredBy = formData.get("administeredBy") as string || null;
  const lotNumber = formData.get("lotNumber") as string || null;
  const notes = formData.get("notes") as string || null;

  await prisma.vaccination.create({
    data: {
      familyMemberId,
      vaccineName,
      doseNumber,
      dateAdministered: new Date(dateAdministered),
      nextDoseDate: nextDoseDate ? new Date(nextDoseDate) : null,
      administeredBy,
      lotNumber,
      notes,
    },
  });

  revalidatePath("/vaccinations");
  revalidatePath("/dashboard");
}

export async function deleteVaccinationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const record = await prisma.vaccination.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!record) return;

  await prisma.vaccination.delete({ where: { id } });
  revalidatePath("/vaccinations");
}
