"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createEmergencyContactAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyMemberId = formData.get("familyMemberId") as string;

  // Verify familyMember belongs to household
  const member = await prisma.familyMember.findFirst({ where: { id: familyMemberId, householdId } });
  if (!member) return;

  await prisma.emergencyContact.create({
    data: {
      familyMemberId,
      name: formData.get("name") as string,
      relationship: formData.get("relationship") as string,
      phoneNumber: formData.get("phoneNumber") as string,
      alternatePhone: formData.get("alternatePhone") as string || null,
      email: formData.get("email") as string || null,
      address: formData.get("address") as string || null,
      priority: parseInt(formData.get("priority") as string || "1"),
    },
  });

  revalidatePath("/emergency-contacts");
}

export async function deleteEmergencyContactAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const record = await prisma.emergencyContact.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!record) return;

  await prisma.emergencyContact.delete({ where: { id } });
  revalidatePath("/emergency-contacts");
}
