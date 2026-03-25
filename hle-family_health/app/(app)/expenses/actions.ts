"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { createFinanceTransaction } from "@/lib/finance-bridge";
import type { ExpenseCategory } from "@prisma/client";

export async function createExpenseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const familyMemberId = formData.get("familyMemberId") as string;

  // Verify familyMember belongs to household
  const member = await prisma.familyMember.findFirst({ where: { id: familyMemberId, householdId } });
  if (!member) return;

  const description = formData.get("description") as string;
  const category = formData.get("category") as ExpenseCategory || "OTHER";
  const amount = parseFloat(formData.get("amount") as string);
  const expenseDate = new Date(formData.get("expenseDate") as string);

  await prisma.medicalExpense.create({
    data: {
      familyMemberId,
      description,
      category,
      amount,
      expenseDate,
      paidFromHsa: formData.get("paidFromHsa") === "on",
      insuranceReimbursement: formData.get("insuranceReimbursement") ? parseFloat(formData.get("insuranceReimbursement") as string) : null,
      notes: formData.get("notes") as string || null,
    },
  });

  // Optionally sync to Family Finance
  const addToFinance = formData.get("addToFinance") as string;
  const financeAccountId = formData.get("financeAccountId") as string;
  const financeCategoryId = formData.get("financeCategoryId") as string;

  if (addToFinance === "true" && financeAccountId) {
    const memberName = `${member.firstName} ${member.lastName}`;
    const categoryLabel = category.replace(/_/g, " ");
    await createFinanceTransaction({
      householdId,
      accountId: financeAccountId,
      categoryId: financeCategoryId || null,
      amount,
      date: expenseDate,
      payee: "Medical Expense",
      description: `${description} (${memberName} - ${categoryLabel})`,
      createdByUserId: user.id,
    });
  }

  revalidatePath("/expenses");
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const record = await prisma.medicalExpense.findFirst({
    where: { id, familyMember: { householdId } },
  });
  if (!record) return;

  await prisma.medicalExpense.delete({ where: { id } });
  revalidatePath("/expenses");
}
