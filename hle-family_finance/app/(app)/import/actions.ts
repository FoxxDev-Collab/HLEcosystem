"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { parseWellsFargoCSV, parseGenericCSV, parseOFX } from "@/lib/import-parser";

export async function uploadImportAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const file = formData.get("file") as File;
  const accountId = formData.get("accountId") as string;
  const format = formData.get("format") as string || "CSV";

  if (!file || !accountId) return;

  const content = await file.text();
  const fileName = file.name;

  // Parse based on format
  let parsed;
  if (format === "WELLS_FARGO") {
    parsed = parseWellsFargoCSV(content);
  } else if (format === "OFX") {
    parsed = parseOFX(content);
  } else {
    parsed = parseGenericCSV(content);
  }

  // Determine storage format
  const fileFormat = format === "OFX" ? "OFX" : "CSV";

  if (parsed.length === 0) return;

  // Create import batch
  const batch = await prisma.importBatch.create({
    data: {
      householdId,
      accountId,
      fileName,
      format: fileFormat,
      importedByUserId: user.id,
      totalRows: parsed.length,
    },
  });

  // Check for duplicates via externalId pattern
  const existingExternalIds = new Set(
    (
      await prisma.transaction.findMany({
        where: { householdId, accountId, externalId: { not: null } },
        select: { externalId: true },
      })
    ).map((t) => t.externalId)
  );

  // Apply category rules
  const rules = await prisma.categoryRule.findMany({
    where: { householdId, isActive: true },
    orderBy: { priority: "desc" },
  });

  let duplicateCount = 0;

  const records = parsed.map((tx) => {
    const externalId = `${tx.date}:${tx.amount}:${tx.description}`;
    const isDuplicate = existingExternalIds.has(externalId);
    if (isDuplicate) duplicateCount++;

    let suggestedCategoryId: string | null = null;
    for (const rule of rules) {
      const target = tx.description.toLowerCase();
      const pattern = rule.pattern.toLowerCase();

      let matches = false;
      if (rule.matchType === "CONTAINS") matches = target.includes(pattern);
      else if (rule.matchType === "STARTS_WITH") matches = target.startsWith(pattern);
      else if (rule.matchType === "EXACT") matches = target === pattern;
      else if (rule.matchType === "REGEX") {
        try { matches = new RegExp(rule.pattern, "i").test(tx.description); } catch { /* ignore */ }
      }

      if (matches) { suggestedCategoryId = rule.categoryId; break; }
    }

    return {
      importBatchId:   batch.id,
      date:            new Date(tx.date),
      amount:          tx.amount,
      description:     tx.description,
      payee:           tx.payee,
      checkNumber:     tx.checkNumber ?? null,
      referenceNumber: tx.referenceNumber ?? null,
      rawData:         tx.rawData,
      matchStatus:     (isDuplicate ? "DUPLICATE" : "PENDING") as "DUPLICATE" | "PENDING",
      suggestedCategoryId,
    };
  });

  await prisma.importedTransaction.createMany({ data: records });

  // Update batch counts
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { duplicateCount },
  });

  revalidatePath("/import");
  redirect(`/import/${batch.id}`);
}

export async function confirmImportAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const batchId = formData.get("batchId") as string;

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { transactions: { where: { matchStatus: "PENDING" } } },
  });
  if (!batch) return;

  let importedCount = 0;

  for (const imported of batch.transactions) {
    const type = Number(imported.amount) >= 0 ? "INCOME" : "EXPENSE";
    const amount = Math.abs(Number(imported.amount));
    const externalId = `${imported.date.toISOString().split("T")[0]}:${Number(imported.amount)}:${imported.description}`;

    const created = await prisma.transaction.create({
      data: {
        householdId,
        accountId: batch.accountId,
        type: type === "INCOME" ? "INCOME" : "EXPENSE",
        amount,
        date: imported.date,
        payee: imported.payee,
        description: imported.description,
        categoryId: imported.suggestedCategoryId,
        externalId,
        createdByUserId: user.id,
      },
    });

    // Balance updated by sync_account_balance DB trigger on the INSERT above.

    await prisma.importedTransaction.update({
      where: { id: imported.id },
      data: { matchStatus: "IMPORTED", createdTransactionId: created.id },
    });

    importedCount++;
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { isFinalized: true, importedCount },
  });

  revalidatePath("/import");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  redirect("/import");
}

export async function skipImportedTransactionAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  await prisma.importedTransaction.update({
    where: { id },
    data: { matchStatus: "SKIPPED" },
  });
  revalidatePath("/import");
}
