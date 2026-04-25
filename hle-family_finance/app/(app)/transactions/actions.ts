"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { categorizeTransaction } from "@/lib/claude-api";
import prisma from "@/lib/prisma";

const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).nullable(),
  amount: z.coerce.number().positive(),
  date: z.coerce.date(),
  payee: z.string().min(1).nullable(),
  description: z.string().min(1).nullable(),
  transferToAccountId: z.string().min(1).nullable(),
});

const updateTransactionSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1).nullable(),
  payee: z.string().min(1).nullable(),
  description: z.string().min(1).nullable(),
});

const deleteTransactionSchema = z.object({
  id: z.string().min(1),
});

export async function createTransactionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const parsed = createTransactionSchema.safeParse({
    type: formData.get("type"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") || null,
    amount: formData.get("amount"),
    date: formData.get("date"),
    payee: formData.get("payee") || null,
    description: formData.get("description") || null,
    transferToAccountId: formData.get("transferToAccountId") || null,
  });
  if (!parsed.success) return;

  const { type, accountId, categoryId, date, payee, description } = parsed.data;
  const amount = Math.abs(parsed.data.amount);
  const transferToAccountId = type === "TRANSFER" ? parsed.data.transferToAccountId : null;

  // Tenant scoping: verify the account(s) belong to this household before mutating balances
  const account = await prisma.account.findFirst({ where: { id: accountId, householdId } });
  if (!account) return;
  if (transferToAccountId) {
    const destAccount = await prisma.account.findFirst({
      where: { id: transferToAccountId, householdId },
    });
    if (!destAccount) return;
  }

  await prisma.transaction.create({
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
  // Account balance is updated by the sync_account_balance DB trigger.

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}

export async function updateTransactionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const parsed = updateTransactionSchema.safeParse({
    id: formData.get("id"),
    categoryId: formData.get("categoryId") || null,
    payee: formData.get("payee") || null,
    description: formData.get("description") || null,
  });
  if (!parsed.success) return;

  const { id, categoryId, payee, description } = parsed.data;

  await prisma.transaction.update({
    where: { id, householdId },
    data: { categoryId, payee, description },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const parsed = deleteTransactionSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) return;

  const { id } = parsed.data;

  const tx = await prisma.transaction.findUnique({ where: { id, householdId } });
  if (!tx) return;

  // Delete the transaction; the sync_account_balance DB trigger automatically
  // reverses the balance effect on the affected account(s).
  await prisma.transaction.delete({ where: { id } });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}

export type SuggestCategoryResult = {
  categoryName: string;
  confidence: number;
  reasoning: string;
} | { error: string } | null;

export async function suggestCategoryAction(
  payee: string,
  description: string,
  amount: number | undefined,
  categoryNames: string[]
): Promise<SuggestCategoryResult> {
  const user = await getCurrentUser();
  if (!user) return null;

  const text = [payee, description].filter(Boolean).join(" — ");
  if (!text.trim()) return null;

  const result = await categorizeTransaction(text, payee || undefined, amount, categoryNames);

  if (!result.success || !result.data) {
    return { error: result.error ?? "Failed to get suggestion" };
  }

  return {
    categoryName: result.data.category,
    confidence: result.data.confidence,
    reasoning: result.data.reasoning,
  };
}
