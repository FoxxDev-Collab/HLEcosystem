import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import {
  initChunkedUpload,
  saveChunk,
  assembleChunks,
  abortChunkedUpload,
} from "@/lib/file-storage";
import { sanitizeFilename, isBlockedExtension } from "@/lib/file-validation";

// POST /api/files/upload/chunked — Initialize or complete a chunked upload
// Action is determined by the "action" field: "init", "complete", or "abort"
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "No household selected" }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as string;

  // ── INIT ──
  if (action === "init") {
    const fileName = body.fileName as string;
    const fileSize = body.fileSize as number;

    if (!fileName || !fileSize) {
      return NextResponse.json({ error: "fileName and fileSize required" }, { status: 400 });
    }

    const sanitized = sanitizeFilename(fileName);
    if (isBlockedExtension(sanitized)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 422 });
    }

    const uploadId = await initChunkedUpload(householdId);

    return NextResponse.json({
      uploadId,
      chunkSize: 5 * 1024 * 1024, // 5MB chunks recommended
    });
  }

  // ── COMPLETE ──
  if (action === "complete") {
    const uploadId = body.uploadId as string;
    const fileName = body.fileName as string;
    const folderId = (body.folderId as string) || null;
    const isPersonal = body.isPersonal === true;
    const mimeType = (body.mimeType as string) || "application/octet-stream";

    if (!uploadId || !fileName) {
      return NextResponse.json({ error: "uploadId and fileName required" }, { status: 400 });
    }

    const sanitized = sanitizeFilename(fileName);

    try {
      const { storagePath, contentHash, size } = await assembleChunks(
        householdId,
        uploadId,
        sanitized
      );

      const created = await prisma.$transaction(async (tx) => {
        let quota = await tx.storageQuota.findUnique({
          where: { householdId },
        });

        if (!quota) {
          quota = await tx.storageQuota.create({ data: { householdId } });
        }

        if (quota.usedStorageBytes + BigInt(size) > quota.maxStorageBytes) {
          throw new Error("Storage quota exceeded");
        }

        const fileRecord = await tx.file.create({
          data: {
            householdId,
            folderId,
            ownerId: isPersonal ? user.id : null,
            name: sanitized,
            originalName: fileName,
            mimeType,
            size: BigInt(size),
            storagePath,
            contentHash,
            uploadedByUserId: user.id,
          },
        });

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

        await tx.storageQuota.update({
          where: { householdId },
          data: { usedStorageBytes: { increment: BigInt(size) } },
        });

        return fileRecord;
      });

      return NextResponse.json({
        id: created.id,
        name: created.name,
        size: created.size.toString(),
        contentHash: created.contentHash,
      }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assembly failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── ABORT ──
  if (action === "abort") {
    const uploadId = body.uploadId as string;
    if (uploadId) {
      await abortChunkedUpload(householdId, uploadId);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// PUT /api/files/upload/chunked — Upload a single chunk
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "No household selected" }, { status: 403 });
  }

  const uploadId = request.headers.get("x-upload-id");
  const chunkIndexStr = request.headers.get("x-chunk-index");

  if (!uploadId || chunkIndexStr === null) {
    return NextResponse.json(
      { error: "x-upload-id and x-chunk-index headers required" },
      { status: 400 }
    );
  }

  const chunkIndex = parseInt(chunkIndexStr, 10);
  if (isNaN(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
  }

  const body = request.body;
  if (!body) {
    return NextResponse.json({ error: "No body" }, { status: 400 });
  }

  try {
    const size = await saveChunk(householdId, uploadId, chunkIndex, body);
    return NextResponse.json({ chunkIndex, size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chunk save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
