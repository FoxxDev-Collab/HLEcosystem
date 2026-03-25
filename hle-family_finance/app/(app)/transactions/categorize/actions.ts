"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { categorizeTransaction } from "@/lib/claude-api";
import prisma from "@/lib/prisma";

export type TransactionSuggestion = {
  id: string;
  payee: string | null;
  description: string | null;
  amount: number;
  date: string;
  accountName: string;
  suggestedCategory: string;
  suggestedCategoryId: string | null;
  confidence: number;
  reasoning: string;
};

export type NewCategory = {
  id: string;
  name: string;
  color: string;
};

export type BulkSuggestResult = {
  suggestions: TransactionSuggestion[];
  newCategories: NewCategory[];
} | {
  error: string;
};

// Colors assigned to auto-created categories in rotation
const AUTO_COLORS = [
  "#22c55e", "#f97316", "#3b82f6", "#8b5cf6", "#ef4444",
  "#14b8a6", "#ec4899", "#0ea5e9", "#eab308", "#6366f1",
  "#a855f7", "#06b6d4", "#84cc16", "#f472b6", "#78716c",
];

export async function bulkSuggestCategoriesAction(
  transactionIds: string[]
): Promise<BulkSuggestResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  if (transactionIds.length === 0) return { suggestions: [], newCategories: [] };

  // Limit batch size to avoid excessive API calls
  const batchIds = transactionIds.slice(0, 25);

  const [transactions, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { id: { in: batchIds }, householdId, categoryId: null },
      include: { account: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.category.findMany({
      where: { householdId, isArchived: false },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (transactions.length === 0) return { suggestions: [], newCategories: [] };

  const categoryNames = categories.map((c) => c.name);
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  // Collect raw suggestions first
  const rawSuggestions: {
    id: string;
    payee: string | null;
    description: string | null;
    amount: number;
    date: string;
    accountName: string;
    suggestedCategory: string;
    confidence: number;
    reasoning: string;
  }[] = [];

  // Process in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (tx) => {
        const text = [tx.payee, tx.description].filter(Boolean).join(" — ");
        if (!text.trim()) return null;

        const result = await categorizeTransaction(
          text,
          tx.payee ?? undefined,
          Number(tx.amount),
          categoryNames
        );

        if (!result.success || !result.data) return null;

        return {
          id: tx.id,
          payee: tx.payee,
          description: tx.description,
          amount: Number(tx.amount),
          date: tx.date.toISOString().split("T")[0],
          accountName: tx.account.name,
          suggestedCategory: result.data.category,
          confidence: result.data.confidence,
          reasoning: result.data.reasoning,
        };
      })
    );

    for (const r of results) {
      if (r) rawSuggestions.push(r);
    }
  }

  // Find category names Claude suggested that don't exist yet
  const newCategoryNames = new Set<string>();
  for (const s of rawSuggestions) {
    if (!categoryMap.has(s.suggestedCategory.toLowerCase())) {
      newCategoryNames.add(s.suggestedCategory);
    }
  }

  // Auto-create missing categories
  const newCategories: NewCategory[] = [];
  const maxSortOrder = categories.length > 0
    ? Math.max(...categories.map((c) => c.sortOrder))
    : -1;
  let nextSort = maxSortOrder + 1;
  let colorIdx = categories.length % AUTO_COLORS.length;

  for (const name of newCategoryNames) {
    const color = AUTO_COLORS[colorIdx % AUTO_COLORS.length];
    colorIdx++;

    const created = await prisma.category.create({
      data: {
        householdId,
        name,
        type: "EXPENSE",
        color,
        sortOrder: nextSort++,
      },
    });

    categoryMap.set(name.toLowerCase(), created.id);
    newCategories.push({ id: created.id, name, color });
  }

  // Build final suggestions with IDs mapped
  const suggestions: TransactionSuggestion[] = rawSuggestions.map((s) => ({
    ...s,
    suggestedCategoryId: categoryMap.get(s.suggestedCategory.toLowerCase()) ?? null,
  }));

  if (newCategories.length > 0) {
    revalidatePath("/categories");
  }

  return { suggestions, newCategories };
}

export async function applyCategoryAction(
  transactionId: string,
  categoryId: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  // Verify both belong to household
  const [tx, category] = await Promise.all([
    prisma.transaction.findFirst({ where: { id: transactionId, householdId } }),
    prisma.category.findFirst({ where: { id: categoryId, householdId } }),
  ]);

  if (!tx || !category) return { error: "Transaction or category not found" };

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { categoryId },
  });

  revalidatePath("/transactions");
  revalidatePath("/transactions/categorize");
  revalidatePath("/dashboard");
  return {};
}

export async function bulkApplyCategoriesAction(
  assignments: { transactionId: string; categoryId: string }[]
): Promise<{ applied: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  let applied = 0;

  for (const { transactionId, categoryId } of assignments) {
    const [tx, category] = await Promise.all([
      prisma.transaction.findFirst({ where: { id: transactionId, householdId } }),
      prisma.category.findFirst({ where: { id: categoryId, householdId } }),
    ]);

    if (tx && category) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { categoryId },
      });
      applied++;
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/transactions/categorize");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");

  return { applied };
}
