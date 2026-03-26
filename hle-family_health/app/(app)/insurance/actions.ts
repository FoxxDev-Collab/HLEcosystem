"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { InsuranceType } from "@prisma/client";

export async function createInsurancePolicyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const coveredMemberIds = formData.getAll("coveredMemberIds") as string[];

  // Verify all selected members belong to household
  if (coveredMemberIds.length > 0) {
    const validMembers = await prisma.familyMember.findMany({
      where: { id: { in: coveredMemberIds }, householdId },
      select: { id: true },
    });
    const validIds = new Set(validMembers.map((m) => m.id));
    const filtered = coveredMemberIds.filter((id) => validIds.has(id));
    if (filtered.length === 0) return;
  }

  await prisma.insurancePolicy.create({
    data: {
      householdId,
      providerName: formData.get("providerName") as string,
      policyNumber: formData.get("policyNumber") as string,
      groupNumber: (formData.get("groupNumber") as string) || null,
      policyHolderName: (formData.get("policyHolderName") as string) || null,
      insuranceType: (formData.get("insuranceType") as InsuranceType) || "MEDICAL",
      phoneNumber: (formData.get("phoneNumber") as string) || null,
      website: (formData.get("website") as string) || null,
      deductible: formData.get("deductible") ? parseFloat(formData.get("deductible") as string) : null,
      outOfPocketMax: formData.get("outOfPocketMax") ? parseFloat(formData.get("outOfPocketMax") as string) : null,
      copay: formData.get("copay") ? parseFloat(formData.get("copay") as string) : null,
      effectiveDate: formData.get("effectiveDate") ? new Date(formData.get("effectiveDate") as string) : null,
      expirationDate: formData.get("expirationDate") ? new Date(formData.get("expirationDate") as string) : null,
      coveredMembers: {
        create: coveredMemberIds.map((memberId) => ({
          familyMemberId: memberId,
        })),
      },
    },
  });

  revalidatePath("/insurance");
}

export async function updatePolicyCoverageAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const policyId = formData.get("policyId") as string;
  const coveredMemberIds = formData.getAll("coveredMemberIds") as string[];

  const policy = await prisma.insurancePolicy.findFirst({
    where: { id: policyId, householdId },
  });
  if (!policy) return;

  // Replace all coverage entries
  await prisma.$transaction([
    prisma.insurancePolicyCoverage.deleteMany({ where: { policyId } }),
    ...coveredMemberIds.map((memberId) =>
      prisma.insurancePolicyCoverage.create({
        data: { policyId, familyMemberId: memberId },
      })
    ),
  ]);

  revalidatePath("/insurance");
}

export async function togglePolicyActiveAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";

  const record = await prisma.insurancePolicy.findFirst({
    where: { id, householdId },
  });
  if (!record) return;

  await prisma.insurancePolicy.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/insurance");
}

export async function deletePolicyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const record = await prisma.insurancePolicy.findFirst({
    where: { id, householdId },
  });
  if (!record) return;

  await prisma.insurancePolicy.delete({ where: { id } });
  revalidatePath("/insurance");
}
