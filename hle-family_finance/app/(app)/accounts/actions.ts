"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { AccountType } from "@prisma/client";

export async function createAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const type = formData.get("type") as AccountType;
  const institution = formData.get("institution") as string || null;
  const initialBalance = parseFloat(formData.get("initialBalance") as string || "0");
  const color = formData.get("color") as string || "#6366f1";

  await prisma.account.create({
    data: {
      householdId,
      name,
      type,
      institution,
      initialBalance,
      currentBalance: initialBalance,
      color,
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  redirect("/accounts");
}

export async function updateAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as AccountType;
  const institution = formData.get("institution") as string || null;
  const color = formData.get("color") as string || "#6366f1";

  await prisma.account.update({
    where: { id, householdId },
    data: { name, type, institution, color },
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  redirect("/accounts");
}

export async function adjustBalanceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const accountId = formData.get("accountId") as string;
  const targetBalance = parseFloat(formData.get("targetBalance") as string);

  if (!accountId || isNaN(targetBalance)) return;

  const account = await prisma.account.findUnique({
    where: { id: accountId, householdId },
  });
  if (!account) return;

  const currentBalance = Number(account.currentBalance);
  const difference = targetBalance - currentBalance;
  if (difference === 0) {
    revalidatePath(`/accounts/${accountId}`);
    return;
  }

  // Find or create "Balance Adjustment" category (type: TRANSFER, excluded from reports)
  let category = await prisma.category.findFirst({
    where: { householdId, name: "Balance Adjustment" },
  });
  if (!category) {
    category = await prisma.category.create({
      data: {
        householdId,
        name: "Balance Adjustment",
        type: "TRANSFER",
        icon: "scale",
        color: "#6b7280",
      },
    });
  }

  // Create the adjustment transaction
  const type = difference > 0 ? "INCOME" : "EXPENSE";
  const amount = Math.abs(difference);

  await prisma.transaction.create({
    data: {
      householdId,
      accountId,
      categoryId: category.id,
      type,
      amount,
      date: new Date(),
      payee: "Balance Adjustment",
      description: `Adjusted from ${formatCurrencyPlain(currentBalance)} to ${formatCurrencyPlain(targetBalance)}`,
      isBalanceAdjustment: true,
      createdByUserId: user.id,
    },
  });

  // Update the account balance
  await prisma.account.update({
    where: { id: accountId },
    data: { currentBalance: targetBalance },
  });

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

function formatCurrencyPlain(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export async function archiveAccountAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const isArchived = formData.get("isArchived") === "true";

  await prisma.account.update({
    where: { id, householdId },
    data: { isArchived: !isArchived },
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;

  // Verify the account belongs to this household
  const account = await prisma.account.findUnique({
    where: { id, householdId },
  });
  if (!account) return;

  // Delete related data in order (respect FK constraints)
  // 1. ImportedTransactions -> ImportBatches
  const batches = await prisma.importBatch.findMany({
    where: { accountId: id },
    select: { id: true },
  });
  if (batches.length > 0) {
    await prisma.importedTransaction.deleteMany({
      where: { importBatchId: { in: batches.map((b) => b.id) } },
    });
    await prisma.importBatch.deleteMany({ where: { accountId: id } });
  }

  // 2. BillPayments linked to transactions on this account
  await prisma.billPayment.deleteMany({
    where: { linkedTransaction: { accountId: id } },
  });

  // 3. DebtPayments linked to transactions on this account
  await prisma.debtPayment.deleteMany({
    where: { linkedTransaction: { accountId: id } },
  });

  // 4. Recurring transactions for this account
  await prisma.recurringTransaction.deleteMany({
    where: { accountId: id },
  });

  // 5. Transactions (handles both accountId and transferToAccountId)
  await prisma.transaction.deleteMany({
    where: { OR: [{ accountId: id }, { transferToAccountId: id }] },
  });

  // 6. Delete the account
  await prisma.account.delete({ where: { id } });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  redirect("/accounts");
}
