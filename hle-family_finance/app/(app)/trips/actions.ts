"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join, extname } from "path";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { TripStatus, TripExpenseType } from "@prisma/client";

const UPLOADS_DIR = "/app/uploads";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".heic"]);

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}

// Map TripExpenseType to default category name
const EXPENSE_TYPE_CATEGORY_MAP: Record<TripExpenseType, string> = {
  GAS: "Gas & Fuel",
  FOOD: "Dining Out",
  LODGING: "Travel",
  TRANSPORT: "Travel",
  SUPPLIES: "Shopping",
  OTHER: "Travel",
};

function revalidateTripPaths(tripId?: string) {
  revalidatePath("/trips");
  if (tripId) revalidatePath(`/trips/${tripId}`);
}

export async function createTripAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string)?.trim() || null;
  const destination = (formData.get("destination") as string)?.trim() || null;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const isTaxDeductible = formData.get("isTaxDeductible") === "on";
  const taxPurpose = isTaxDeductible ? ((formData.get("taxPurpose") as string)?.trim() || null) : null;
  const budgetPlannerProjectId = (formData.get("budgetPlannerProjectId") as string) || null;

  const trip = await prisma.trip.create({
    data: {
      householdId,
      name,
      description,
      destination,
      startDate,
      endDate,
      isTaxDeductible,
      taxPurpose,
      budgetPlannerProjectId: budgetPlannerProjectId || null,
    },
  });

  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

export async function updateTripAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string)?.trim() || null;
  const destination = (formData.get("destination") as string)?.trim() || null;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const isTaxDeductible = formData.get("isTaxDeductible") === "on";
  const taxPurpose = isTaxDeductible ? ((formData.get("taxPurpose") as string)?.trim() || null) : null;
  const budgetPlannerProjectId = (formData.get("budgetPlannerProjectId") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  await prisma.trip.update({
    where: { id, householdId },
    data: {
      name,
      description,
      destination,
      startDate,
      endDate,
      isTaxDeductible,
      taxPurpose,
      budgetPlannerProjectId: budgetPlannerProjectId || null,
      notes,
    },
  });

  revalidateTripPaths(id);
}

export async function updateTripStatusAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const status = formData.get("status") as TripStatus;

  await prisma.trip.update({
    where: { id, householdId },
    data: { status },
  });

  revalidateTripPaths(id);
}

export async function deleteTripAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;

  // Clean up receipt files before cascade delete removes the records
  const expenses = await prisma.tripExpense.findMany({
    where: { tripId: id },
    select: { receiptPath: true },
  });
  for (const expense of expenses) {
    if (expense.receiptPath) {
      try { await unlink(expense.receiptPath); } catch { /* file may not exist */ }
    }
  }

  await prisma.trip.delete({ where: { id, householdId } });

  revalidatePath("/trips");
  redirect("/trips");
}

export async function addTripExpenseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const tripId = formData.get("tripId") as string;
  const expenseType = formData.get("expenseType") as TripExpenseType;
  const date = new Date(formData.get("date") as string);
  const amount = Math.abs(parseFloat(formData.get("amount") as string));
  const payee = (formData.get("payee") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const accountId = formData.get("accountId") as string;
  const categoryIdOverride = (formData.get("categoryId") as string) || null;

  // Verify trip belongs to this household
  const trip = await prisma.trip.findUnique({ where: { id: tripId, householdId } });
  if (!trip) return;

  // Resolve category: use override or auto-map from expense type
  let categoryId = categoryIdOverride;
  if (!categoryId) {
    const categoryName = EXPENSE_TYPE_CATEGORY_MAP[expenseType];
    const category = await prisma.category.findFirst({
      where: { householdId, name: categoryName, parentCategoryId: null },
    });
    categoryId = category?.id ?? null;
  }

  // Create the real Transaction
  const transaction = await prisma.transaction.create({
    data: {
      householdId,
      type: "EXPENSE",
      accountId,
      categoryId,
      amount,
      date,
      payee,
      description,
      createdByUserId: user.id,
    },
  });

  // Balance updated by sync_account_balance DB trigger on the INSERT above.

  // Create the TripExpense linking to the transaction
  const tripExpense = await prisma.tripExpense.create({
    data: {
      tripId,
      transactionId: transaction.id,
      expenseType,
      date,
      amount,
      payee,
      description,
    },
  });

  // Handle receipt upload if provided
  const file = formData.get("receipt") as File | null;
  if (file && file.size > 0 && file.size <= MAX_FILE_SIZE) {
    const ext = extname(file.name).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      const dirPath = join(UPLOADS_DIR, householdId, "trips", tripId);
      await mkdir(dirPath, { recursive: true });

      const safeFilename = `${tripExpense.id}_${sanitizeFilename(file.name)}`;
      const filePath = join(dirPath, safeFilename);

      const buffer = Buffer.from(await file.arrayBuffer());
      const contentHash = createHash("sha256").update(buffer).digest("hex");
      await writeFile(filePath, buffer);

      await prisma.tripExpense.update({
        where: { id: tripExpense.id },
        data: {
          receiptFileName: file.name,
          receiptPath: filePath,
          receiptFileSize: file.size,
          receiptHash: contentHash,
          receiptUploadedAt: new Date(),
        },
      });
    }
  }

  revalidateTripPaths(tripId);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}

export async function deleteTripExpenseAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const tripId = formData.get("tripId") as string;
  const deleteTransaction = formData.get("deleteTransaction") === "true";

  const expense = await prisma.tripExpense.findUnique({
    where: { id },
    include: { trip: { select: { householdId: true } } },
  });
  if (!expense || expense.trip.householdId !== householdId) return;

  // Clean up receipt file
  if (expense.receiptPath) {
    try { await unlink(expense.receiptPath); } catch { /* file may not exist */ }
  }

  // Delete the TripExpense record
  await prisma.tripExpense.delete({ where: { id } });

  // Optionally delete the linked transaction.
  // The sync_account_balance DB trigger automatically reverses the balance
  // effect on DELETE — no explicit account.update needed.
  if (deleteTransaction && expense.transactionId) {
    await prisma.transaction.delete({ where: { id: expense.transactionId } });
  }

  revalidateTripPaths(tripId);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}

export async function uploadExpenseReceiptAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const expenseId = formData.get("expenseId") as string;
  const tripId = formData.get("tripId") as string;
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return;
  if (file.size > MAX_FILE_SIZE) return;

  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return;

  // Verify expense belongs to this household
  const expense = await prisma.tripExpense.findUnique({
    where: { id: expenseId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!expense || expense.trip.householdId !== householdId) return;

  // Delete existing file if replacing
  if (expense.receiptPath) {
    try { await unlink(expense.receiptPath); } catch { /* file may not exist */ }
  }

  const dirPath = join(UPLOADS_DIR, householdId, "trips", tripId);
  await mkdir(dirPath, { recursive: true });

  const safeFilename = `${expenseId}_${sanitizeFilename(file.name)}`;
  const filePath = join(dirPath, safeFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(buffer).digest("hex");
  await writeFile(filePath, buffer);

  await prisma.tripExpense.update({
    where: { id: expenseId },
    data: {
      receiptFileName: file.name,
      receiptPath: filePath,
      receiptFileSize: file.size,
      receiptHash: contentHash,
      receiptUploadedAt: new Date(),
    },
  });

  revalidateTripPaths(tripId);
}

export async function deleteExpenseReceiptAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const expenseId = formData.get("expenseId") as string;
  const tripId = formData.get("tripId") as string;

  const expense = await prisma.tripExpense.findUnique({
    where: { id: expenseId },
    include: { trip: { select: { householdId: true } } },
  });
  if (!expense || expense.trip.householdId !== householdId) return;

  if (expense.receiptPath) {
    try { await unlink(expense.receiptPath); } catch { /* file may not exist */ }
  }

  await prisma.tripExpense.update({
    where: { id: expenseId },
    data: {
      receiptFileName: null,
      receiptPath: null,
      receiptFileSize: null,
      receiptHash: null,
      receiptUploadedAt: null,
    },
  });

  revalidateTripPaths(tripId);
}
