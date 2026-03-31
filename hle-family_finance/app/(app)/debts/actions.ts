"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { DebtType } from "@prisma/client";

export async function createDebtAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const type = formData.get("type") as DebtType;
  const lender = formData.get("lender") as string || null;
  const originalPrincipal = parseFloat(formData.get("originalPrincipal") as string);
  const currentBalance = parseFloat(formData.get("currentBalance") as string);
  const interestRate = parseFloat(formData.get("interestRate") as string || "0");
  const minimumPayment = formData.get("minimumPayment") ? parseFloat(formData.get("minimumPayment") as string) : null;

  await prisma.debt.create({
    data: {
      householdId,
      name,
      type,
      lender,
      originalPrincipal,
      currentBalance,
      interestRate: interestRate / 100, // Store as decimal
      minimumPayment,
    },
  });

  revalidatePath("/debts");
  redirect("/debts");
}

export async function recordDebtPaymentAction(formData: FormData): Promise<void> {
  const debtId = formData.get("debtId") as string;
  const totalAmount = parseFloat(formData.get("totalAmount") as string);
  const principalAmount = parseFloat(formData.get("principalAmount") as string || "0");
  const interestAmount = parseFloat(formData.get("interestAmount") as string || "0");

  const debt = await prisma.debt.findUnique({ where: { id: debtId } });
  if (!debt) return;

  const remainingBalance = Number(debt.currentBalance) - principalAmount;

  await prisma.debtPayment.create({
    data: {
      debtId,
      paymentDate: new Date(),
      totalAmount,
      principalAmount,
      interestAmount,
      remainingBalance,
    },
  });

  await prisma.debt.update({
    where: { id: debtId },
    data: { currentBalance: remainingBalance },
  });

  revalidatePath("/debts");
}

export async function updateDebtAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as DebtType;
  const lender = (formData.get("lender") as string) || null;
  const originalPrincipal = parseFloat(formData.get("originalPrincipal") as string);
  const currentBalance = parseFloat(formData.get("currentBalance") as string);
  const interestRate = parseFloat(formData.get("interestRate") as string || "0");
  const minimumPayment = formData.get("minimumPayment")
    ? parseFloat(formData.get("minimumPayment") as string)
    : null;

  // Verify ownership
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return { error: "Debt not found" };
  }

  await prisma.debt.update({
    where: { id },
    data: {
      name,
      type,
      lender,
      originalPrincipal,
      currentBalance,
      interestRate: interestRate / 100,
      minimumPayment,
    },
  });

  revalidatePath("/debts");
  revalidatePath(`/debts/${id}`);
  return {};
}

export async function deleteDebtAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  // Verify ownership
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) return;

  // Payments cascade-delete via Prisma schema
  await prisma.debt.delete({ where: { id } });

  revalidatePath("/debts");
  redirect("/debts");
}

export async function archiveDebtAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const isArchived = formData.get("isArchived") === "true";

  await prisma.debt.update({
    where: { id },
    data: { isArchived: !isArchived },
  });

  revalidatePath("/debts");
}
