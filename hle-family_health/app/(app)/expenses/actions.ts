"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { ExpenseCategory } from "@prisma/client";

export async function createExpenseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await prisma.medicalExpense.create({
    data: {
      familyMemberId: formData.get("familyMemberId") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as ExpenseCategory || "OTHER",
      amount: parseFloat(formData.get("amount") as string),
      expenseDate: new Date(formData.get("expenseDate") as string),
      paidFromHsa: formData.get("paidFromHsa") === "on",
      insuranceReimbursement: formData.get("insuranceReimbursement") ? parseFloat(formData.get("insuranceReimbursement") as string) : null,
      notes: formData.get("notes") as string || null,
    },
  });

  revalidatePath("/expenses");
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await prisma.medicalExpense.delete({ where: { id } });
  revalidatePath("/expenses");
}
