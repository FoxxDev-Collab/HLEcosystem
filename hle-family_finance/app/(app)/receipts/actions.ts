"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { parseReceipt, categorizeTransaction } from "@/lib/claude-api";
import prisma from "@/lib/prisma";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type ReceiptScanResult = {
  success: true;
  data: {
    store: string;
    date: string;
    items: { name: string; price: number; category: string }[];
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string | null;
  };
} | {
  success: false;
  error: string;
};

export async function scanReceiptAction(formData: FormData): Promise<ReceiptScanResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const file = formData.get("receipt") as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false, error: "No file provided" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large (max 25 MB)" };
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return { success: false, error: "Unsupported file type. Use JPEG, PNG, WebP, or GIF." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageBase64 = buffer.toString("base64");

  const result = await parseReceipt(imageBase64, file.type);

  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? "Failed to parse receipt" };
  }

  return { success: true, data: result.data };
}

export type CategorySuggestion = {
  category: string;
  confidence: number;
  reasoning: string;
} | null;

export async function suggestCategoryAction(
  store: string,
  itemSummary: string,
  categoryNames: string[]
): Promise<CategorySuggestion> {
  const user = await getCurrentUser();
  if (!user) return null;

  const description = `Receipt from ${store}: ${itemSummary}`;
  const result = await categorizeTransaction(description, store, undefined, categoryNames);

  if (!result.success || !result.data) return null;
  return result.data;
}

export async function createTransactionsFromReceiptAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const accountId = formData.get("accountId") as string;
  const categoryId = formData.get("categoryId") as string | null;
  const dataJson = formData.get("receiptData") as string;

  if (!accountId || !dataJson) return;

  const data = JSON.parse(dataJson) as {
    store: string;
    date: string;
    total: number;
    items: { name: string; price: number; category: string }[];
  };

  // Verify account belongs to household
  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId },
  });
  if (!account) return;

  // Verify category belongs to household (if provided)
  let validCategoryId: string | null = null;
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, householdId },
    });
    validCategoryId = category?.id ?? null;
  }

  // Create a single expense transaction for the receipt total
  const transactionDate = new Date(data.date);
  const amount = Math.abs(data.total);

  // Build description from items
  const itemSummary = data.items.map((i) => i.name).join(", ");
  const description = itemSummary.length > 200 ? itemSummary.substring(0, 197) + "..." : itemSummary;

  await prisma.transaction.create({
    data: {
      householdId,
      type: "EXPENSE",
      accountId,
      categoryId: validCategoryId,
      amount,
      date: transactionDate,
      payee: data.store,
      description,
      createdByUserId: user.id,
    },
  });

  // Balance updated by sync_account_balance DB trigger on the INSERT above.

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/receipts");

  redirect("/transactions");
}
