"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { Relationship, PreferredContactMethod, ImportantDateType } from "@prisma/client";

/**
 * Syncs a FamilyMember's birthday and anniversary fields to the ImportantDate
 * table so they appear on the dashboard and dates page. Creates, updates, or
 * removes the corresponding ImportantDate record as needed.
 */
async function syncMemberDates(
  householdId: string,
  memberId: string,
  firstName: string,
  lastName: string,
  birthday: Date | null,
  anniversary: Date | null,
) {
  const dateConfigs: { type: ImportantDateType; date: Date | null; label: string }[] = [
    { type: "BIRTHDAY", date: birthday, label: `${firstName} ${lastName}'s Birthday` },
    { type: "ANNIVERSARY", date: anniversary, label: `${firstName} ${lastName} — Wedding Anniversary` },
  ];

  for (const { type, date, label } of dateConfigs) {
    // Find existing auto-synced record for this member + type
    const existing = await prisma.importantDate.findFirst({
      where: { householdId, familyMemberId: memberId, type },
    });

    if (date && existing) {
      // Update existing record
      await prisma.importantDate.update({
        where: { id: existing.id },
        data: { date, label },
      });
    } else if (date && !existing) {
      // Create new record
      await prisma.importantDate.create({
        data: {
          householdId,
          familyMemberId: memberId,
          label,
          date,
          type,
          recurrenceType: "ANNUAL",
          reminderDaysBefore: 14,
        },
      });
    } else if (!date && existing) {
      // Date was cleared — remove the record
      await prisma.importantDate.delete({ where: { id: existing.id } });
    }
  }
}

export async function createFamilyMemberAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const birthday = formData.get("birthday") as string;
  const anniversary = formData.get("anniversary") as string;

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const birthdayDate = birthday ? new Date(birthday) : null;
  const anniversaryDate = anniversary ? new Date(anniversary) : null;

  const member = await prisma.familyMember.create({
    data: {
      householdId,
      firstName,
      lastName,
      nickname: (formData.get("nickname") as string) || null,
      relationshipNotes: (formData.get("relationshipNotes") as string) || null,
      birthday: birthdayDate,
      anniversary: anniversaryDate,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      preferredContactMethod: (formData.get("preferredContactMethod") as PreferredContactMethod) || "NONE",
      addressLine1: (formData.get("addressLine1") as string) || null,
      addressLine2: (formData.get("addressLine2") as string) || null,
      city: (formData.get("city") as string) || null,
      state: (formData.get("state") as string) || null,
      zipCode: (formData.get("zipCode") as string) || null,
      country: (formData.get("country") as string) || null,
      notes: (formData.get("notes") as string) || null,
      includeInHolidayCards: formData.get("includeInHolidayCards") === "on",
    },
  });

  await syncMemberDates(householdId, member.id, firstName, lastName, birthdayDate, anniversaryDate);

  revalidatePath("/people");
  revalidatePath("/dates");
  revalidatePath("/dashboard");
  redirect("/people");
}

export async function updateFamilyMemberAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const birthday = formData.get("birthday") as string;
  const anniversary = formData.get("anniversary") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const birthdayDate = birthday ? new Date(birthday) : null;
  const anniversaryDate = anniversary ? new Date(anniversary) : null;

  await prisma.familyMember.update({
    where: { id, householdId },
    data: {
      firstName,
      lastName,
      nickname: (formData.get("nickname") as string) || null,
      relationshipNotes: (formData.get("relationshipNotes") as string) || null,
      birthday: birthdayDate,
      anniversary: anniversaryDate,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      preferredContactMethod: (formData.get("preferredContactMethod") as PreferredContactMethod) || "NONE",
      addressLine1: (formData.get("addressLine1") as string) || null,
      addressLine2: (formData.get("addressLine2") as string) || null,
      city: (formData.get("city") as string) || null,
      state: (formData.get("state") as string) || null,
      zipCode: (formData.get("zipCode") as string) || null,
      country: (formData.get("country") as string) || null,
      notes: (formData.get("notes") as string) || null,
      includeInHolidayCards: formData.get("includeInHolidayCards") === "on",
    },
  });

  await syncMemberDates(householdId, id, firstName, lastName, birthdayDate, anniversaryDate);

  revalidatePath(`/people/${id}`);
  revalidatePath("/people");
  revalidatePath("/dates");
  revalidatePath("/dashboard");
  redirect(`/people/${id}`);
}

export async function toggleActiveMemberAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const member = await prisma.familyMember.findUnique({ where: { id, householdId } });
  if (!member) return;

  await prisma.familyMember.update({
    where: { id, householdId },
    data: { isActive: !member.isActive },
  });

  revalidatePath("/people");
}

export async function deleteFamilyMemberAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;

  // Remove auto-synced ImportantDate records before deleting the member
  // (ImportantDate uses SetNull, so they'd become orphaned otherwise)
  await prisma.importantDate.deleteMany({
    where: { householdId, familyMemberId: id, type: { in: ["BIRTHDAY", "ANNIVERSARY"] } },
  });

  await prisma.familyMember.delete({ where: { id, householdId } });

  revalidatePath("/people");
  revalidatePath("/dates");
  revalidatePath("/dashboard");
  redirect("/people");
}

export async function syncHouseholdMemberAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const userId = formData.get("userId") as string;
  const displayName = formData.get("displayName") as string;
  const familyRelationship = (formData.get("familyRelationship") as string) || "Other";

  if (!userId || !displayName) return;

  const parts = displayName.trim().split(" ");
  const firstName = parts[0] || displayName;
  const lastName = parts.slice(1).join(" ") || "";

  const member = await prisma.familyMember.create({
    data: {
      householdId,
      linkedUserId: userId,
      firstName,
      lastName,
      relationship: familyRelationship ? (familyRelationship as Relationship) : null,
    },
  });

  revalidatePath("/people");
  redirect(`/people/${member.id}`);
}
