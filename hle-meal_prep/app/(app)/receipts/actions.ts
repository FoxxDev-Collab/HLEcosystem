"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { parseReceipt, categorizeProduct } from "@/lib/claude-api";
import { createFinanceTransaction, getFinanceExpenseCategories } from "@/lib/finance-bridge";
import prisma from "@/lib/prisma";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
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

export type ProductMatch = {
  receiptItem: string;
  receiptPrice: number;
  receiptCategory: string;
  matchedProductId: string | null;
  matchedProductName: string | null;
  isNew: boolean;
};

export async function matchReceiptItemsAction(
  items: { name: string; price: number; category: string }[]
): Promise<ProductMatch[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  const products = await prisma.product.findMany({
    where: { householdId, isActive: true },
    select: { id: true, name: true },
  });

  const productMap = new Map(products.map((p) => [p.name.toLowerCase(), p]));

  return items.map((item) => {
    const key = item.name.toLowerCase().trim();
    const match = productMap.get(key);

    return {
      receiptItem: item.name,
      receiptPrice: item.price,
      receiptCategory: item.category,
      matchedProductId: match?.id ?? null,
      matchedProductName: match?.name ?? null,
      isNew: !match,
    };
  });
}

export async function processReceiptAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const dataJson = formData.get("receiptData") as string;
  const storeId = formData.get("storeId") as string;
  const addToFinance = formData.get("addToFinance") === "true";
  const financeAccountId = formData.get("financeAccountId") as string | null;
  const financeCategoryId = formData.get("financeCategoryId") as string | null;

  if (!dataJson || !storeId) return { error: "Missing data" };

  const data = JSON.parse(dataJson) as {
    store: string;
    date: string;
    total: number;
    items: { name: string; price: number; category: string }[];
  };

  // Verify store belongs to household
  const store = await prisma.store.findFirst({
    where: { id: storeId, householdId },
  });
  if (!store) return { error: "Store not found" };

  const receiptDate = new Date(data.date);

  // Process each item: create product if needed, add price entry
  for (const item of data.items) {
    const key = item.name.toLowerCase().trim();

    // Find or create product
    let product = await prisma.product.findFirst({
      where: {
        householdId,
        name: { equals: item.name, mode: "insensitive" },
      },
    });

    if (!product) {
      // Try to find a matching category
      let categoryId: string | null = null;
      const categories = await prisma.category.findMany({
        where: { householdId },
        select: { id: true, name: true },
      });

      const catMatch = categories.find(
        (c) => c.name.toLowerCase() === item.category.toLowerCase()
      );
      categoryId = catMatch?.id ?? null;

      product = await prisma.product.create({
        data: {
          householdId,
          name: item.name,
          categoryId,
          defaultUnit: "EACH",
        },
      });
    }

    // Create price entry
    await prisma.storePrice.create({
      data: {
        productId: product.id,
        storeId: store.id,
        price: item.price,
        observedAt: receiptDate,
      },
    });
  }

  // Cross-app: create finance transaction if requested
  if (addToFinance && financeAccountId) {
    const itemSummary = data.items.map((i) => i.name).join(", ");
    const description = itemSummary.length > 200 ? itemSummary.substring(0, 197) + "..." : itemSummary;

    await createFinanceTransaction({
      householdId,
      accountId: financeAccountId,
      categoryId: financeCategoryId || null,
      amount: data.total,
      date: receiptDate,
      payee: data.store,
      description,
      createdByUserId: user.id,
    });
  }

  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  revalidatePath("/price-compare");
  revalidatePath("/pantry");

  return {};
}
