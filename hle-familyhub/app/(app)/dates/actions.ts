"use server";

import { revalidatePath } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ImportantDateType, RecurrenceType } from "@prisma/client";

export async function createImportantDateAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const familyMemberId = formData.get("familyMemberId") as string;
  const reminderDays = parseInt(formData.get("reminderDaysBefore") as string) || 14;

  await prisma.importantDate.create({
    data: {
      householdId,
      familyMemberId: familyMemberId || null,
      label: formData.get("label") as string,
      date: new Date(formData.get("date") as string),
      type: formData.get("type") as ImportantDateType,
      recurrenceType: (formData.get("recurrenceType") as RecurrenceType) || "ANNUAL",
      reminderDaysBefore: reminderDays,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/dates");
  revalidatePath("/dashboard");
}

export async function updateImportantDateAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const familyMemberId = formData.get("familyMemberId") as string;
  const reminderDays = parseInt(formData.get("reminderDaysBefore") as string) || 14;

  await prisma.importantDate.update({
    where: { id, householdId },
    data: {
      familyMemberId: familyMemberId || null,
      label: formData.get("label") as string,
      date: new Date(formData.get("date") as string),
      type: formData.get("type") as ImportantDateType,
      recurrenceType: (formData.get("recurrenceType") as RecurrenceType) || "ANNUAL",
      reminderDaysBefore: reminderDays,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/dates");
  revalidatePath("/dashboard");
}

export async function deleteImportantDateAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  await prisma.importantDate.delete({ where: { id, householdId } });

  revalidatePath("/dates");
  revalidatePath("/dashboard");
}
