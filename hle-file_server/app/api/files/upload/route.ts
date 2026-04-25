import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { validateUpload, validateMimeType } from "@/lib/file-validation";
import { saveFileStreaming, generateThumbnail } from "@/lib/file-storage";
import { logAudit, getClientIp } from "@/lib/audit";

// Single-file streaming upload — no memory buffering.
// For files over ~100MB, prefer the chunked upload API instead.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "No household selected" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const folderId = (formData.get("folderId") as string) || null;
  const isPersonal = formData.get("isPersonal") === "true";

  // Validate name, extension, and size first
  const validation = validateUpload({
    name: file.name,
    size: file.size,
    buffer: Buffer.alloc(0), // size/extension check only at this stage
    type: file.type,
  });

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, name: file.name },
      { status: 422 }
    );
  }

  // Read first 64 bytes for magic-byte MIME detection without buffering the full file.
  // file.slice() reads only those bytes; file.stream() below streams the full file separately.
  const headerBytes = await file.slice(0, 64).arrayBuffer();
  const { detectedMime } = validateMimeType(Buffer.from(headerBytes), file.type);

  try {
    // Stream file to disk — no memory buffering
    const fileStream = file.stream();
    const { storagePath, contentHash, size } = await saveFileStreaming(
      householdId,
      fileStream,
      validation.sanitizedName
    );

    // Create DB records in a transaction
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

      if (quota.usedStorageBytes + BigInt(size) > quota.maxStorageBytes) {
        throw new Error("Storage quota exceeded");
      }

      // Create file record
      const fileRecord = await tx.file.create({
        data: {
          householdId,
          folderId,
          ownerId: isPersonal ? user.id : null,
          name: validation.sanitizedName,
          originalName: file.name,
          mimeType: detectedMime,
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

    logAudit({
      householdId,
      userId: user.id,
      action: "FILE_UPLOAD",
      fileId: created.id,
      details: { name: created.name, size: created.size.toString(), mimeType: detectedMime },
      ipAddress: getClientIp(request),
    });

    // Generate thumbnail in background (non-blocking)
    generateThumbnail(
      householdId,
      created.id,
      storagePath,
      detectedMime
    ).then(async (thumbnailPath) => {
      if (thumbnailPath) {
        await prisma.file.update({
          where: { id: created.id },
          data: { thumbnailPath },
        });
      }
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        size: created.size.toString(),
        contentHash: created.contentHash,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { error: message, name: file.name },
      { status: 500 }
    );
  }
}
