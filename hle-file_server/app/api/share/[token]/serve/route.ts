import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import prisma from "@/lib/prisma";
import { getFileSize } from "@/lib/file-storage";

export async function GET(
  request: NextRequest,
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

  const file = shareLink.file;
  const totalSize = await getFileSize(file.storagePath);
  const rangeHeader = request.headers.get("range");

  // Range request for streaming
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${totalSize}` } });
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize || start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${totalSize}` } });
    }

    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(file.storagePath, { start, end });
    const stream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": chunkSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const nodeStream = createReadStream(file.storagePath);
  const stream = Readable.toWeb(nodeStream) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Content-Length": totalSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
