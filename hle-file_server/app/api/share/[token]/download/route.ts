import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readFileStream } from "@/lib/file-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { file: true },
  });

  if (!shareLink || !shareLink.isActive) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }

  if (shareLink.maxDownloads && shareLink.downloadCount >= shareLink.maxDownloads) {
    return NextResponse.json({ error: "Download limit reached" }, { status: 429 });
  }

  if (shareLink.permission === "VIEW") {
    return NextResponse.json({ error: "Download not permitted" }, { status: 403 });
  }

  // Increment download count
  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: { downloadCount: { increment: 1 } },
  });

  const file = shareLink.file;
  const stream = readFileStream(file.storagePath);

  return new NextResponse(stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
      "Content-Length": file.size.toString(),
      "Cache-Control": "private, no-cache",
    },
  });
}
