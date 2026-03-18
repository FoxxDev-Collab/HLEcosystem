"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { InsuranceType } from "@prisma/client";

export async function createInsuranceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await prisma.insurance.create({
    data: {
      familyMemberId: formData.get("familyMemberId") as string,
      providerName: formData.get("providerName") as string,
      policyNumber: formData.get("policyNumber") as string,
      groupNumber: formData.get("groupNumber") as string || null,
      policyHolderName: formData.get("policyHolderName") as string || null,
      insuranceType: formData.get("insuranceType") as InsuranceType || "MEDICAL",
      phoneNumber: formData.get("phoneNumber") as string || null,
      website: formData.get("website") as string || null,
      deductible: formData.get("deductible") ? parseFloat(formData.get("deductible") as string) : null,
      outOfPocketMax: formData.get("outOfPocketMax") ? parseFloat(formData.get("outOfPocketMax") as string) : null,
      copay: formData.get("copay") ? parseFloat(formData.get("copay") as string) : null,
      effectiveDate: formData.get("effectiveDate") ? new Date(formData.get("effectiveDate") as string) : null,
      expirationDate: formData.get("expirationDate") ? new Date(formData.get("expirationDate") as string) : null,
    },
  });

  revalidatePath("/insurance");
}

export async function toggleInsuranceActiveAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";
  await prisma.insurance.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/insurance");
}

export async function deleteInsuranceAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await prisma.insurance.delete({ where: { id } });
  revalidatePath("/insurance");
}
