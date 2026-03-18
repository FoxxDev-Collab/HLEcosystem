"use server";

import { revalidatePath } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function linkHouseholdAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const linkedHouseholdId = formData.get("linkedHouseholdId") as string;
  const label = (formData.get("label") as string) || null;
  const relationship = (formData.get("relationship") as string) || null;

  if (!linkedHouseholdId || linkedHouseholdId === householdId) return;

  await prisma.linkedHousehold.create({
    data: {
      householdId,
      linkedHouseholdId,
      label,
      relationship,
    },
  });

  revalidatePath("/linked");
  revalidatePath("/family-tree");
  revalidatePath("/family-tree/manage");
}

export async function unlinkHouseholdAction(formData: FormData) {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  await prisma.linkedHousehold.delete({ where: { id, householdId } });

  revalidatePath("/linked");
  revalidatePath("/family-tree");
  revalidatePath("/family-tree/manage");
}
