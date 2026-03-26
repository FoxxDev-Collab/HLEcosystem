"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { PetInsuranceType } from "@prisma/client";

export async function createPetInsuranceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const petId = formData.get("petId") as string;
  const pet = await prisma.pet.findFirst({ where: { id: petId, householdId } });
  if (!pet) return;

  const providerName = formData.get("providerName") as string;
  const policyNumber = formData.get("policyNumber") as string;
  if (!providerName || !policyNumber) return;

  await prisma.petInsurance.create({
    data: {
      petId,
      providerName,
      policyNumber,
      insuranceType: (formData.get("insuranceType") as PetInsuranceType) || "COMPREHENSIVE",
      monthlyPremium: formData.get("monthlyPremium") ? parseFloat(formData.get("monthlyPremium") as string) : null,
      deductible: formData.get("deductible") ? parseFloat(formData.get("deductible") as string) : null,
      annualLimit: formData.get("annualLimit") ? parseFloat(formData.get("annualLimit") as string) : null,
      reimbursementPct: formData.get("reimbursementPct") ? parseInt(formData.get("reimbursementPct") as string) : null,
      effectiveDate: formData.get("effectiveDate") ? new Date(formData.get("effectiveDate") as string) : null,
      expirationDate: formData.get("expirationDate") ? new Date(formData.get("expirationDate") as string) : null,
      phoneNumber: (formData.get("phoneNumber") as string) || null,
      website: (formData.get("website") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/pets");
}

export async function updatePetInsuranceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petInsurance.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petInsurance.update({
    where: { id },
    data: {
      providerName: (formData.get("providerName") as string) || record.providerName,
      policyNumber: (formData.get("policyNumber") as string) || record.policyNumber,
      insuranceType: (formData.get("insuranceType") as PetInsuranceType) || record.insuranceType,
      monthlyPremium: formData.get("monthlyPremium") ? parseFloat(formData.get("monthlyPremium") as string) : null,
      deductible: formData.get("deductible") ? parseFloat(formData.get("deductible") as string) : null,
      annualLimit: formData.get("annualLimit") ? parseFloat(formData.get("annualLimit") as string) : null,
      reimbursementPct: formData.get("reimbursementPct") ? parseInt(formData.get("reimbursementPct") as string) : null,
      effectiveDate: formData.get("effectiveDate") ? new Date(formData.get("effectiveDate") as string) : null,
      expirationDate: formData.get("expirationDate") ? new Date(formData.get("expirationDate") as string) : null,
      phoneNumber: (formData.get("phoneNumber") as string) || null,
      website: (formData.get("website") as string) || null,
      notes: (formData.get("notes") as string) || null,
      isActive: formData.get("isActive") !== "false",
    },
  });

  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}

export async function deletePetInsuranceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const record = await prisma.petInsurance.findFirst({
    where: { id, pet: { householdId } },
  });
  if (!record) return;

  await prisma.petInsurance.delete({ where: { id } });
  revalidatePath(`/pets/${record.petId}`);
  revalidatePath("/pets");
}
