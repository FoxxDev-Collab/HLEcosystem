import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { readFileStream } from "@/lib/file-storage";
import { logAudit, getClientIp } from "@/lib/audit";

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

  // Household file (ownerId null) — accessible to all household members
  // Personal file — accessible only to owner or via share
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

  logAudit({
    householdId,
    userId: user.id,
    action: "FILE_DOWNLOAD",
    fileId: file.id,
    details: { name: file.name },
    ipAddress: getClientIp(_request),
  });

  const stream = readFileStream(file.storagePath);

  return new NextResponse(stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
      "Content-Length": file.size.toString(),
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
