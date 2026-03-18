"use server";

import { revalidatePath } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

export async function setBudgetAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const categoryId = formData.get("categoryId") as string;
  const year = parseInt(formData.get("year") as string);
  const month = parseInt(formData.get("month") as string);
  const amount = parseFloat(formData.get("amount") as string);

  if (amount <= 0) {
    // Delete budget if zero
    await prisma.budget.deleteMany({
      where: { householdId, categoryId, year, month },
    });
  } else {
    await prisma.budget.upsert({
      where: {
        householdId_categoryId_year_month: { householdId, categoryId, year, month },
      },
      update: { amount },
      create: { householdId, categoryId, year, month, amount },
    });
  }

  revalidatePath("/budgets");
}

export async function copyBudgetFromPreviousMonth(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const year = parseInt(formData.get("year") as string);
  const month = parseInt(formData.get("month") as string);

  // Calculate previous month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const previousBudgets = await prisma.budget.findMany({
    where: { householdId, year: prevYear, month: prevMonth },
  });

  for (const budget of previousBudgets) {
    await prisma.budget.upsert({
      where: {
        householdId_categoryId_year_month: {
          householdId,
          categoryId: budget.categoryId,
          year,
          month,
        },
      },
      update: { amount: budget.amount },
      create: {
        householdId,
        categoryId: budget.categoryId,
        year,
        month,
        amount: budget.amount,
      },
    });
  }

  revalidatePath("/budgets");
}
