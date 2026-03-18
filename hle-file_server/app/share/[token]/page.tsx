import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatFileSize, formatDate } from "@/lib/format";
import { getFileCategory } from "@/lib/mime-types";
import { FileIcon } from "@/components/file-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, Shield } from "lucide-react";
import Link from "next/link";

export default async function ShareLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { file: true },
  });

  if (!shareLink || !shareLink.isActive) notFound();

  // Check expiry
  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) notFound();

  // Check download limit
  if (shareLink.maxDownloads && shareLink.downloadCount >= shareLink.maxDownloads) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <Shield className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Download Limit Reached</h2>
            <p className="text-sm text-muted-foreground mt-2">
              This share link has reached its maximum number of downloads.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const file = shareLink.file;
  const category = getFileCategory(file.mimeType);
  const canPreview = ["image", "pdf", "video", "audio"].includes(category);
  const serveUrl = `/api/share/${token}/serve`;
  const downloadUrl = `/api/share/${token}/download`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileIcon mimeType={file.mimeType} className="size-8" />
            <div>
              <CardTitle className="text-xl">{file.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{formatFileSize(file.size)}</Badge>
                <span className="text-sm text-muted-foreground">
                  Uploaded {formatDate(file.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Preview area */}
          {canPreview && category === "image" && (
            <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={serveUrl}
                alt={file.name}
                className="max-w-full max-h-[60vh] object-contain rounded"
              />
            </div>
          )}

          {canPreview && category === "pdf" && (
            <iframe
              src={serveUrl}
              className="w-full h-[70vh] rounded-lg border"
              title={file.name}
            />
          )}

          {canPreview && category === "video" && (
            <video controls className="max-w-full max-h-[60vh] rounded-lg mx-auto">
              <source src={serveUrl} type={file.mimeType} />
            </video>
          )}

          {canPreview && category === "audio" && (
            <div className="p-8 flex items-center justify-center">
              <audio controls className="w-full max-w-lg">
                <source src={serveUrl} type={file.mimeType} />
              </audio>
            </div>
          )}

          {!canPreview && (
            <div className="py-12 text-center text-muted-foreground">
              <FileIcon mimeType={file.mimeType} className="size-16 mx-auto mb-4" />
              <p className="text-sm">Preview not available for this file type</p>
            </div>
          )}

          {/* Download section */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="size-4" />
              <span>Permission: {shareLink.permission}</span>
              {shareLink.expiresAt && (
                <span>&middot; Expires {formatDate(shareLink.expiresAt)}</span>
              )}
            </div>
            {(shareLink.permission === "DOWNLOAD" || shareLink.permission === "EDIT") && (
              <Link href={downloadUrl}>
                <Button>
                  <Download className="size-4 mr-2" />
                  Download
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Shared via HLE File Server
      </p>
    </div>
  );
}
