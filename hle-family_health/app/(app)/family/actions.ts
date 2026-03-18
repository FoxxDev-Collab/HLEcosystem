"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function createFamilyMemberAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const dateOfBirth = formData.get("dateOfBirth") as string;
  const relationship = formData.get("relationship") as string || null;
  const gender = formData.get("gender") as string || null;

  const member = await prisma.familyMember.create({
    data: {
      householdId,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      relationship,
      gender,
    },
  });

  revalidatePath("/family");
  revalidatePath("/dashboard");
  redirect(`/family/${member.id}`);
}

export async function updateFamilyMemberAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const dateOfBirth = formData.get("dateOfBirth") as string;
  const relationship = formData.get("relationship") as string || null;
  const gender = formData.get("gender") as string || null;

  await prisma.familyMember.update({
    where: { id },
    data: {
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      relationship,
      gender,
    },
  });

  revalidatePath("/family");
  revalidatePath(`/family/${id}`);
}

export async function toggleFamilyMemberActiveAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";

  await prisma.familyMember.update({
    where: { id },
    data: { isActive: !isActive },
  });

  revalidatePath("/family");
}
