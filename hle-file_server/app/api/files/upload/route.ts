import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { validateUpload } from "@/lib/file-validation";
import { saveFile } from "@/lib/file-storage";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json(
      { error: "No household selected" },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data" },
      { status: 400 }
    );
  }

  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files provided" },
      { status: 400 }
    );
  }

  const folderId = (formData.get("folderId") as string) || null;
  const isPersonal = formData.get("isPersonal") === "true";

  const results: Array<{
    name: string;
    id?: string;
    error?: string;
  }> = [];

  for (const file of files) {
    if (!(file instanceof File)) {
      results.push({ name: "unknown", error: "Invalid file entry" });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const validation = validateUpload({
      name: file.name,
      size: file.size,
      buffer,
      type: file.type,
    });

    if (!validation.valid) {
      results.push({ name: file.name, error: validation.error });
      continue;
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        // Check storage quota
        let quota = await tx.storageQuota.findUnique({
          where: { householdId },
        });

        if (!quota) {
          quota = await tx.storageQuota.create({
            data: { householdId },
          });
        }

        if (quota.usedStorageBytes + BigInt(file.size) > quota.maxStorageBytes) {
          throw new Error("Storage quota exceeded");
        }

        // Save file to disk
        const { storagePath, contentHash, size } = await saveFile(
          householdId,
          buffer,
          validation.sanitizedName
        );

        // Create file record
        const fileRecord = await tx.file.create({
          data: {
            householdId,
            folderId,
            ownerId: isPersonal ? user.id : null,
            name: validation.sanitizedName,
            originalName: file.name,
            mimeType: validation.detectedMime,
            size: BigInt(size),
            storagePath,
            contentHash,
            uploadedByUserId: user.id,
          },
        });

        // Create initial version
        await tx.fileVersion.create({
          data: {
            fileId: fileRecord.id,
            versionNumber: 1,
            size: BigInt(size),
            storagePath,
            contentHash,
            uploadedByUserId: user.id,
          },
        });

        // Update storage quota
        await tx.storageQuota.update({
          where: { householdId },
          data: {
            usedStorageBytes: { increment: BigInt(size) },
          },
        });

        return fileRecord;
      });

      results.push({
        name: validation.sanitizedName,
        id: created.id,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed";
      results.push({ name: file.name, error: message });
    }
  }

  const hasErrors = results.some((r) => r.error);
  return NextResponse.json(
    { files: results },
    { status: hasErrors ? 207 : 201 }
  );
}
