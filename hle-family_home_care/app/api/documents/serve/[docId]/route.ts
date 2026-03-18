import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { readFileStream, fileExistsOnDisk } from "@/lib/file-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return new NextResponse("No household", { status: 400 });

  const doc = await prisma.document.findFirst({
    where: { id: docId, householdId },
  });

  if (!doc) return new NextResponse("Not found", { status: 404 });

  if (!(await fileExistsOnDisk(doc.storagePath))) {
    return new NextResponse("File not found on disk", { status: 404 });
  }

  const stream = readFileStream(doc.storagePath);

  return new NextResponse(stream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.originalName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
