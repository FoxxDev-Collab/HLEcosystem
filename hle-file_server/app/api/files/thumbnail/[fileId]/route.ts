import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import {
  fileExistsOnDisk,
  readFileBuffer,
  saveThumbnail,
} from "@/lib/file-storage";
import { getFileCategory } from "@/lib/mime-types";

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
  _request: NextRequest,
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

  // Only generate thumbnails for images
  const category = getFileCategory(file.mimeType);
  if (category !== "image") {
    return NextResponse.json(
      { error: "Thumbnails are only available for image files" },
      { status: 404 }
    );
  }

  // Serve existing thumbnail if available
  if (file.thumbnailPath && (await fileExistsOnDisk(file.thumbnailPath))) {
    const thumbnailBuffer = await readFileBuffer(file.thumbnailPath);
    return new NextResponse(new Uint8Array(thumbnailBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": thumbnailBuffer.length.toString(),
        "Cache-Control": "private, max-age=604800",
      },
    });
  }

  // Generate thumbnail
  try {
    const sharp = (await import("sharp")).default;
    const sourceBuffer = await readFileBuffer(file.storagePath);
    const thumbnail = await sharp(sourceBuffer)
      .resize(400, 400, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const thumbnailPath = await saveThumbnail(householdId, file.id, thumbnail);

    await prisma.file.update({
      where: { id: file.id },
      data: { thumbnailPath },
    });

    return new NextResponse(new Uint8Array(thumbnail), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": thumbnail.length.toString(),
        "Cache-Control": "private, max-age=604800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate thumbnail" },
      { status: 500 }
    );
  }
}
