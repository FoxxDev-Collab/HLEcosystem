"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getFamilyHubMemberById } from "@/lib/familyhub-members";
import prisma from "@/lib/prisma";

export async function enableHealthTrackingAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyhubMemberId = formData.get("familyhubMemberId") as string;

  // Verify the FamilyHub member belongs to this household
  const hubMember = await getFamilyHubMemberById(familyhubMemberId, householdId);
  if (!hubMember) return;

  // Check if already tracked by familyhubMemberId
  const existing = await prisma.familyMember.findFirst({
    where: { householdId, familyhubMemberId },
  });
  if (existing) {
    // Reactivate if previously disabled
    if (!existing.isActive) {
      await prisma.familyMember.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      revalidatePath("/family");
      revalidatePath("/dashboard");
    }
    return;
  }

  // Check for a legacy member with the same linkedUserId (created before FamilyHub integration)
  if (hubMember.linkedUserId) {
    const legacyMatch = await prisma.familyMember.findFirst({
      where: { householdId, linkedUserId: hubMember.linkedUserId },
    });
    if (legacyMatch) {
      // Link the legacy member to FamilyHub and reactivate
      await prisma.familyMember.update({
        where: { id: legacyMatch.id },
        data: {
          familyhubMemberId,
          firstName: hubMember.firstName,
          lastName: hubMember.lastName,
          dateOfBirth: hubMember.birthday,
          relationship: hubMember.relationship,
          isActive: true,
        },
      });
      revalidatePath("/family");
      revalidatePath("/dashboard");
      return;
    }
  }

  await prisma.familyMember.create({
    data: {
      householdId,
      familyhubMemberId,
      linkedUserId: hubMember.linkedUserId,
      firstName: hubMember.firstName,
      lastName: hubMember.lastName,
      dateOfBirth: hubMember.birthday,
      relationship: hubMember.relationship,
    },
  });

  revalidatePath("/family");
  revalidatePath("/dashboard");
}

export async function disableHealthTrackingAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const member = await prisma.familyMember.findFirst({
    where: { id, householdId },
    include: { _count: { select: { appointments: true, medications: true, vaccinations: true } } },
  });
  if (!member) return;

  // Only allow disabling if no health data exists (safety check)
  const totalRecords = member._count.appointments + member._count.medications + member._count.vaccinations;
  if (totalRecords > 0) {
    // Has health data — deactivate instead of delete to preserve records
    await prisma.familyMember.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    await prisma.familyMember.delete({ where: { id } });
  }

  revalidatePath("/family");
  revalidatePath("/dashboard");
}

export async function syncMemberFromHubAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const member = await prisma.familyMember.findFirst({
    where: { id, householdId },
  });
  if (!member || !member.familyhubMemberId) return;

  const hubMember = await getFamilyHubMemberById(member.familyhubMemberId, householdId);
  if (!hubMember) return;

  await prisma.familyMember.update({
    where: { id },
    data: {
      firstName: hubMember.firstName,
      lastName: hubMember.lastName,
      dateOfBirth: hubMember.birthday,
      relationship: hubMember.relationship,
      linkedUserId: hubMember.linkedUserId,
    },
  });

  revalidatePath("/family");
  revalidatePath(`/family/${id}`);
}
