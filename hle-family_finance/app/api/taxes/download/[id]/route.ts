import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { extname } from "path";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "No household" }, { status: 403 });
  }

  const doc = await prisma.taxDocument.findUnique({
    where: { id },
    include: { taxYear: { select: { householdId: true } } },
  });

  if (!doc || doc.taxYear.householdId !== householdId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!doc.storagePath || !doc.uploadedFileName) {
    return NextResponse.json({ error: "No file attached" }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(doc.storagePath);
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const ext = extname(doc.uploadedFileName).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${doc.uploadedFileName}"`,
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "private, no-cache",
    },
  });
}
