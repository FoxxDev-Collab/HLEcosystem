"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

const setBudgetSchema = z.object({
  categoryId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number(),
});

const copyBudgetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function setBudgetAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const parsed = setBudgetSchema.safeParse({
    categoryId: formData.get("categoryId"),
    year: formData.get("year"),
    month: formData.get("month"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return;

  const { categoryId, year, month, amount } = parsed.data;

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

  const parsed = copyBudgetSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
  });
  if (!parsed.success) return;

  const { year, month } = parsed.data;

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
