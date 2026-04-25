"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { TransactionType, RecurrenceFrequency } from "@prisma/client";

export async function createRecurringAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const type = formData.get("type") as TransactionType;
  const accountId = formData.get("accountId") as string;
  const categoryId = formData.get("categoryId") as string || null;
  const amount = parseFloat(formData.get("amount") as string);
  const payee = formData.get("payee") as string || null;
  const frequency = formData.get("frequency") as RecurrenceFrequency;
  const dayOfPeriod = formData.get("dayOfPeriod") ? parseInt(formData.get("dayOfPeriod") as string) : null;
  const startDate = formData.get("startDate") as string;
  const autoCreate = formData.get("autoCreate") === "on";

  // Calculate next occurrence
  const start = new Date(startDate);
  const nextOccurrence = start > new Date() ? start : calculateNextOccurrence(start, frequency, 1, dayOfPeriod);

  await prisma.recurringTransaction.create({
    data: {
      householdId,
      name,
      type,
      accountId,
      categoryId,
      amount,
      payee,
      frequency,
      dayOfPeriod,
      startDate: start,
      nextOccurrence,
      autoCreate,
    },
  });

  revalidatePath("/recurring");
}

export async function toggleRecurringActiveAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";

  await prisma.recurringTransaction.update({
    where: { id, householdId },
    data: { isActive: !isActive },
  });

  revalidatePath("/recurring");
}

export async function skipNextOccurrenceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  const recurring = await prisma.recurringTransaction.findFirst({ where: { id, householdId } });
  if (!recurring || !recurring.nextOccurrence) return;

  const nextOccurrence = calculateNextOccurrence(
    recurring.nextOccurrence,
    recurring.frequency,
    recurring.frequencyInterval,
    recurring.dayOfPeriod
  );

  // Don't go past end date
  if (recurring.endDate && nextOccurrence > recurring.endDate) {
    await prisma.recurringTransaction.update({
      where: { id, householdId },
      data: { isActive: false, nextOccurrence: null },
    });
  } else {
    await prisma.recurringTransaction.update({
      where: { id, householdId },
      data: { nextOccurrence },
    });
  }

  revalidatePath("/recurring");
}

export async function deleteRecurringAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  await prisma.recurringTransaction.delete({ where: { id, householdId } });
  revalidatePath("/recurring");
}

export async function processDueRecurringAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const dueRecurrings = await prisma.recurringTransaction.findMany({
    where: {
      householdId,
      isActive: true,
      autoCreate: true,
      nextOccurrence: { lte: today },
    },
  });

  for (const recurring of dueRecurrings) {
    if (!recurring.nextOccurrence) continue;

    // Create the transaction
    await prisma.transaction.create({
      data: {
        householdId,
        accountId: recurring.accountId,
        categoryId: recurring.categoryId,
        transferToAccountId: recurring.transferToAccountId,
        recurringTransactionId: recurring.id,
        type: recurring.type,
        amount: recurring.amount,
        date: recurring.nextOccurrence,
        payee: recurring.payee,
        description: `Auto: ${recurring.name}`,
        createdByUserId: user.id,
      },
    });

    // Update account balance — householdId included to enforce ownership at DB layer
    const amount = Number(recurring.amount);
    if (recurring.type === "EXPENSE") {
      await prisma.account.update({
        where: { id: recurring.accountId, householdId },
        data: { currentBalance: { decrement: amount } },
      });
    } else if (recurring.type === "INCOME") {
      await prisma.account.update({
        where: { id: recurring.accountId, householdId },
        data: { currentBalance: { increment: amount } },
      });
    }

    // Calculate next occurrence
    const nextOccurrence = calculateNextOccurrence(
      recurring.nextOccurrence,
      recurring.frequency,
      recurring.frequencyInterval,
      recurring.dayOfPeriod
    );

    // Check end date
    if (recurring.endDate && nextOccurrence > recurring.endDate) {
      await prisma.recurringTransaction.update({
        where: { id: recurring.id },
        data: { isActive: false, nextOccurrence: null, lastProcessed: recurring.nextOccurrence },
      });
    } else {
      await prisma.recurringTransaction.update({
        where: { id: recurring.id },
        data: { nextOccurrence, lastProcessed: recurring.nextOccurrence },
      });
    }
  }

  revalidatePath("/recurring");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}

function calculateNextOccurrence(
  current: Date,
  frequency: RecurrenceFrequency,
  interval: number,
  dayOfPeriod: number | null
): Date {
  const next = new Date(current);

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7 * interval);
      break;
    case "BI_WEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + interval);
      if (dayOfPeriod) next.setDate(Math.min(dayOfPeriod, daysInMonth(next)));
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      if (dayOfPeriod) next.setDate(Math.min(dayOfPeriod, daysInMonth(next)));
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + interval);
      break;
  }

  return next;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
