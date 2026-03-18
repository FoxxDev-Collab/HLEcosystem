"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { ProviderType } from "@prisma/client";

export async function createProviderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  await prisma.provider.create({
    data: {
      householdId,
      name: formData.get("name") as string,
      type: formData.get("type") as ProviderType || "DOCTOR",
      specialty: formData.get("specialty") as string || null,
      phoneNumber: formData.get("phoneNumber") as string || null,
      address: formData.get("address") as string || null,
      email: formData.get("email") as string || null,
      website: formData.get("website") as string || null,
      portalUrl: formData.get("portalUrl") as string || null,
      notes: formData.get("notes") as string || null,
    },
  });

  revalidatePath("/providers");
}

export async function toggleProviderActiveAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";
  await prisma.provider.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/providers");
}

export async function deleteProviderAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await prisma.provider.delete({ where: { id } });
  revalidatePath("/providers");
}
