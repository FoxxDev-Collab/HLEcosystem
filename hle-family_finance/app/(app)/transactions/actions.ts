"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { TransactionType } from "@prisma/client";

export async function createTransactionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const type = formData.get("type") as TransactionType;
  const accountId = formData.get("accountId") as string;
  const categoryId = formData.get("categoryId") as string || null;
  const amount = Math.abs(parseFloat(formData.get("amount") as string));
  const date = new Date(formData.get("date") as string);
  const payee = formData.get("payee") as string || null;
  const description = formData.get("description") as string || null;
  const transferToAccountId = type === "TRANSFER" ? (formData.get("transferToAccountId") as string || null) : null;

  const transaction = await prisma.transaction.create({
    data: {
      householdId,
      type,
      accountId,
      categoryId,
      amount,
      date,
      payee,
      description,
      transferToAccountId,
      createdByUserId: user.id,
    },
  });

  // Update account balance
  if (type === "EXPENSE") {
    await prisma.account.update({
      where: { id: accountId },
      data: { currentBalance: { decrement: amount } },
    });
  } else if (type === "INCOME") {
    await prisma.account.update({
      where: { id: accountId },
      data: { currentBalance: { increment: amount } },
    });
  } else if (type === "TRANSFER") {
    await prisma.account.update({
      where: { id: accountId },
      data: { currentBalance: { decrement: amount } },
    });
    if (transferToAccountId) {
      await prisma.account.update({
        where: { id: transferToAccountId },
        data: { currentBalance: { increment: amount } },
      });
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}

export async function updateTransactionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const id = formData.get("id") as string;
  const categoryId = formData.get("categoryId") as string || null;
  const payee = formData.get("payee") as string || null;
  const description = formData.get("description") as string || null;

  await prisma.transaction.update({
    where: { id, householdId },
    data: { categoryId, payee, description },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;

  // Get transaction to reverse balance
  const tx = await prisma.transaction.findUnique({ where: { id, householdId } });
  if (!tx) return;

  // Reverse balance
  if (tx.type === "EXPENSE") {
    await prisma.account.update({
      where: { id: tx.accountId },
      data: { currentBalance: { increment: Number(tx.amount) } },
    });
  } else if (tx.type === "INCOME") {
    await prisma.account.update({
      where: { id: tx.accountId },
      data: { currentBalance: { decrement: Number(tx.amount) } },
    });
  } else if (tx.type === "TRANSFER") {
    await prisma.account.update({
      where: { id: tx.accountId },
      data: { currentBalance: { increment: Number(tx.amount) } },
    });
    if (tx.transferToAccountId) {
      await prisma.account.update({
        where: { id: tx.transferToAccountId },
        data: { currentBalance: { decrement: Number(tx.amount) } },
      });
    }
  }

  await prisma.transaction.delete({ where: { id } });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}
