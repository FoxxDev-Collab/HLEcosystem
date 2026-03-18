"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join, extname } from "path";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { TaxFilingStatus, TaxDocumentType } from "@prisma/client";

const UPLOADS_DIR = "/app/uploads";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".heic"]);

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}

function revalidateTaxPaths(taxYearId?: string) {
  revalidatePath("/taxes");
  if (taxYearId) revalidatePath(`/taxes/${taxYearId}`);
}

export async function createTaxYearAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const year = parseInt(formData.get("year") as string);
  const federalFilingStatus = formData.get("federalFilingStatus") as TaxFilingStatus || null;
  const state = (formData.get("state") as string)?.trim() || null;

  await prisma.taxYear.create({
    data: { householdId, year, federalFilingStatus, state },
  });

  revalidatePath("/taxes");
}

export async function updateTaxYearAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const federalFilingStatus = (formData.get("federalFilingStatus") as TaxFilingStatus) || null;
  const state = (formData.get("state") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  await prisma.taxYear.update({
    where: { id },
    data: { federalFilingStatus, state, notes },
  });

  revalidateTaxPaths(id);
}

export async function updateTaxRefundAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;
  const federalRefund = formData.get("federalRefund") ? parseFloat(formData.get("federalRefund") as string) : null;
  const stateRefund = formData.get("stateRefund") ? parseFloat(formData.get("stateRefund") as string) : null;
  const federalOwed = formData.get("federalOwed") ? parseFloat(formData.get("federalOwed") as string) : null;
  const stateOwed = formData.get("stateOwed") ? parseFloat(formData.get("stateOwed") as string) : null;

  await prisma.taxYear.update({
    where: { id },
    data: { federalRefund, stateRefund, federalOwed, stateOwed },
  });

  revalidateTaxPaths(id);
}

export async function deleteTaxYearAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const id = formData.get("id") as string;

  // Clean up any uploaded files for this tax year's documents
  const docs = await prisma.taxDocument.findMany({ where: { taxYearId: id } });
  for (const doc of docs) {
    if (doc.storagePath) {
      try { await unlink(doc.storagePath); } catch { /* file may not exist */ }
    }
  }

  await prisma.taxYear.delete({ where: { id } });

  revalidatePath("/taxes");
  redirect("/taxes");
}

export async function addTaxDocumentAction(formData: FormData): Promise<void> {
  const taxYearId = formData.get("taxYearId") as string;
  const documentType = formData.get("documentType") as TaxDocumentType;
  const issuer = formData.get("issuer") as string;
  const grossAmount = formData.get("grossAmount") ? parseFloat(formData.get("grossAmount") as string) : null;
  const federalWithheld = formData.get("federalWithheld") ? parseFloat(formData.get("federalWithheld") as string) : null;
  const stateWithheld = formData.get("stateWithheld") ? parseFloat(formData.get("stateWithheld") as string) : null;
  const socialSecurityWithheld = formData.get("socialSecurityWithheld") ? parseFloat(formData.get("socialSecurityWithheld") as string) : null;
  const medicareWithheld = formData.get("medicareWithheld") ? parseFloat(formData.get("medicareWithheld") as string) : null;
  const description = (formData.get("description") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const expectedDate = formData.get("expectedDate") ? new Date(formData.get("expectedDate") as string) : null;

  await prisma.taxDocument.create({
    data: {
      taxYearId, documentType, issuer, grossAmount, federalWithheld,
      stateWithheld, socialSecurityWithheld, medicareWithheld,
      description, notes, expectedDate,
    },
  });

  revalidateTaxPaths(taxYearId);
}

export async function deleteTaxDocumentAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const taxYearId = formData.get("taxYearId") as string;

  const doc = await prisma.taxDocument.findUnique({ where: { id } });
  if (doc?.storagePath) {
    try { await unlink(doc.storagePath); } catch { /* file may not exist */ }
  }

  await prisma.taxDocument.delete({ where: { id } });

  revalidateTaxPaths(taxYearId);
}

export async function markDocumentReceivedAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const taxYearId = formData.get("taxYearId") as string;
  const isReceived = formData.get("isReceived") === "true";

  await prisma.taxDocument.update({
    where: { id },
    data: { isReceived: !isReceived, receivedDate: !isReceived ? new Date() : null },
  });

  revalidateTaxPaths(taxYearId);
}

export async function markTaxFiledAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const type = formData.get("type") as string;

  if (type === "federal") {
    await prisma.taxYear.update({
      where: { id },
      data: { isFederalFiled: true, federalFiledDate: new Date() },
    });
  } else {
    await prisma.taxYear.update({
      where: { id },
      data: { isStateFiled: true, stateFiledDate: new Date() },
    });
  }

  revalidateTaxPaths(id);
}

export async function markRefundReceivedAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const refundReceived = formData.get("refundReceived") === "true";

  await prisma.taxYear.update({
    where: { id },
    data: {
      refundReceived: !refundReceived,
      refundReceivedDate: !refundReceived ? new Date() : null,
    },
  });

  revalidateTaxPaths(id);
}

export async function markOwedPaidAction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const type = formData.get("type") as string;

  if (type === "federal") {
    const ty = await prisma.taxYear.findUnique({ where: { id } });
    await prisma.taxYear.update({
      where: { id },
      data: { federalOwedPaid: !ty?.federalOwedPaid },
    });
  } else {
    const ty = await prisma.taxYear.findUnique({ where: { id } });
    await prisma.taxYear.update({
      where: { id },
      data: { stateOwedPaid: !ty?.stateOwedPaid },
    });
  }

  revalidateTaxPaths(id);
}

export async function uploadTaxDocumentFileAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const documentId = formData.get("documentId") as string;
  const taxYearId = formData.get("taxYearId") as string;
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return;
  if (file.size > MAX_FILE_SIZE) return;

  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return;

  // Verify document belongs to this household
  const doc = await prisma.taxDocument.findUnique({
    where: { id: documentId },
    include: { taxYear: { select: { householdId: true } } },
  });
  if (!doc || doc.taxYear.householdId !== householdId) return;

  // Delete existing file if replacing
  if (doc.storagePath) {
    try { await unlink(doc.storagePath); } catch { /* file may not exist */ }
  }

  // Build storage path and write file
  const dirPath = join(UPLOADS_DIR, householdId, "taxes", taxYearId);
  await mkdir(dirPath, { recursive: true });

  const safeFilename = `${documentId}_${sanitizeFilename(file.name)}`;
  const filePath = join(dirPath, safeFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(buffer).digest("hex");
  await writeFile(filePath, buffer);

  await prisma.taxDocument.update({
    where: { id: documentId },
    data: {
      uploadedFileName: file.name,
      storagePath: filePath,
      fileSize: file.size,
      contentHash,
      uploadedAt: new Date(),
    },
  });

  revalidateTaxPaths(taxYearId);
}

export async function deleteTaxDocumentFileAction(formData: FormData): Promise<void> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const documentId = formData.get("documentId") as string;
  const taxYearId = formData.get("taxYearId") as string;

  const doc = await prisma.taxDocument.findUnique({
    where: { id: documentId },
    include: { taxYear: { select: { householdId: true } } },
  });
  if (!doc || doc.taxYear.householdId !== householdId) return;

  if (doc.storagePath) {
    try { await unlink(doc.storagePath); } catch { /* file may not exist */ }
  }

  await prisma.taxDocument.update({
    where: { id: documentId },
    data: {
      uploadedFileName: null,
      storagePath: null,
      fileSize: null,
      contentHash: null,
      uploadedAt: null,
    },
  });

  revalidateTaxPaths(taxYearId);
}
