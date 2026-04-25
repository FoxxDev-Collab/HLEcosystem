import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getFileSize } from "@/lib/file-storage";
import { UNSAFE_INLINE_MIME_TYPES } from "@/lib/file-validation";

// HTML, JS, and SVG served inline from the same origin can run scripts.
// Force them to download instead.
function safeContentType(mimeType: string): string {
  return UNSAFE_INLINE_MIME_TYPES.has(mimeType) ? "application/octet-stream" : mimeType;
}

function safeDisposition(mimeType: string, name: string): string {
  const encoded = encodeURIComponent(name);
  return UNSAFE_INLINE_MIME_TYPES.has(mimeType)
    ? `attachment; filename="${encoded}"`
    : `inline; filename="${encoded}"`;
}

async function canAccessFile(
  fileId: string,
  householdId: string,
  userId: string
) {
  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      householdId,
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      shares: {
        where: { sharedWithUserId: userId },
      },
    },
  });

  if (!file) return null;

  if (
    file.ownerId !== null &&
    file.ownerId !== userId &&
    file.shares.length === 0
  ) {
    return null;
  }

  return file;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
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

  const { fileId } = await params;

  const file = await canAccessFile(fileId, householdId, user.id);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const totalSize = await getFileSize(file.storagePath);
  const rangeHeader = request.headers.get("range");

  // Range request for video/audio streaming
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid range header" },
        { status: 416 }
      );
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${totalSize}`,
        },
      });
    }

    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(file.storagePath, { start, end });
    const stream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Type": safeContentType(file.mimeType),
        "Content-Disposition": safeDisposition(file.mimeType, file.name),
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": chunkSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Full file serve (inline)
  const nodeStream = createReadStream(file.storagePath);
  const stream = Readable.toWeb(nodeStream) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": safeContentType(file.mimeType),
      "Content-Disposition": safeDisposition(file.mimeType, file.name),
      "Content-Length": totalSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
