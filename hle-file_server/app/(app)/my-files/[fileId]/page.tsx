import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getUserById } from "@/lib/users";
import prisma from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getFileCategory } from "@/lib/mime-types";
import { formatFileSize, formatDate, formatMimeType } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileIcon } from "@/components/file-icon";
import { TextPreview } from "@/components/preview/text-preview";
import { FileTagManager } from "@/components/file-tag-manager";
import { FileShareManager } from "@/components/file-share-manager";
import { deleteFileAction } from "@/app/(app)/browse/actions";
import { moveToHouseholdAction } from "./actions";
import {
  ArrowLeft,
  Download,
  Trash2,
  FolderOpen,
  Calendar,
  User,
  HardDrive,
  History,
  File,
  Upload,
} from "lucide-react";
import Link from "next/link";

export default async function MyFileDetailPage({
  params,
}: {
  params: Promise<{ fileId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { fileId } = await params;

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, deletedAt: null },
    include: {
      folder: true,
      tags: { include: { tag: true } },
      versions: { orderBy: { versionNumber: "desc" } },
      shares: true,
      shareLinks: true,
      favorites: { where: { userId: user.id } },
    },
  });

  if (!file) notFound();

  // Access check: must be owner for personal files
  if (file.ownerId !== user.id) {
    notFound();
  }

  const uploader = await getUserById(file.uploadedByUserId);
  const category = getFileCategory(file.mimeType);
  const isFavorited = file.favorites.length > 0;

  // Resolve share user names
  const shareUserIds = file.shares.map((s) => s.sharedWithUserId);
  const shareUsers = shareUserIds.length > 0
    ? await Promise.all(shareUserIds.map((id) => getUserById(id)))
    : [];
  const shareUserMap = new Map(
    shareUsers.filter(Boolean).map((u) => [u!.id, u!.name])
  );

  const backUrl = file.folderId
    ? `/my-files?folderId=${file.folderId}`
    : "/my-files";

  return (
    <div className="space-y-6">
      <Link
        href={backUrl}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to my files
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main preview area */}
        <div className="space-y-4">
          <PreviewArea
            fileId={file.id}
            fileName={file.name}
            mimeType={file.mimeType}
            category={category}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <FileIcon mimeType={file.mimeType} className="size-8 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base leading-snug break-all">{file.name}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{formatMimeType(file.mimeType)}</Badge>
                <Badge variant="outline">{formatFileSize(file.size)}</Badge>
                <Badge variant="outline" className="border-blue-300 text-blue-600 dark:text-blue-400">Personal</Badge>
                {isFavorited && (
                  <Badge variant="default" className="bg-amber-500">Favorited</Badge>
                )}
              </div>

              <Separator />

              {/* Metadata */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="size-4 shrink-0" />
                  <span>Uploaded by {uploader?.name ?? "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="size-4 shrink-0" />
                  <span>Uploaded {formatDate(file.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="size-4 shrink-0" />
                  <span>Modified {formatDate(file.updatedAt)}</span>
                </div>
                {file.folder && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FolderOpen className="size-4 shrink-0" />
                    <Link
                      href={`/my-files?folderId=${file.folder.id}`}
                      className="hover:text-foreground transition-colors hover:underline"
                    >
                      {file.folder.name}
                    </Link>
                  </div>
                )}
                {file.description && (
                  <p className="text-muted-foreground pt-1">{file.description}</p>
                )}
              </div>

              {/* Tags */}
              <Separator />
              <FileTagManager
                fileId={file.id}
                fileTags={file.tags.map((ft) => ({
                  id: ft.id,
                  tag: { id: ft.tag.id, name: ft.tag.name, color: ft.tag.color },
                }))}
              />

              {/* Sharing */}
              <Separator />
              <FileShareManager
                fileId={file.id}
                currentUserId={user.id}
                shares={file.shares.map((s) => ({
                  id: s.id,
                  sharedWithUserId: s.sharedWithUserId,
                  sharedWithName: shareUserMap.get(s.sharedWithUserId),
                  permission: s.permission,
                  createdAt: s.createdAt.toISOString(),
                }))}
                shareLinks={file.shareLinks.map((l) => ({
                  id: l.id,
                  token: l.token,
                  permission: l.permission,
                  expiresAt: l.expiresAt?.toISOString() ?? null,
                  maxDownloads: l.maxDownloads,
                  downloadCount: l.downloadCount,
                  isActive: l.isActive,
                }))}
              />

              {/* Version history */}
              {file.versions.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <History className="size-4" />
                      Version History
                    </div>
                    <div className="space-y-1">
                      {file.versions.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between text-xs text-muted-foreground py-1"
                        >
                          <span>v{v.versionNumber}</span>
                          <span>{formatFileSize(v.size)}</span>
                          <span>{formatDate(v.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button asChild>
                  <a href={`/api/files/download/${file.id}`}>
                    <Download className="size-4 mr-2" />
                    Download
                  </a>
                </Button>
                <form action={moveToHouseholdAction}>
                  <input type="hidden" name="fileId" value={file.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    <Upload className="size-4 mr-2" />
                    Move to Household Files
                  </Button>
                </form>
                <form action={deleteFileAction}>
                  <input type="hidden" name="fileId" value={file.id} />
                  <Button
                    type="submit"
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PreviewArea({
  fileId,
  fileName,
  mimeType,
  category,
}: {
  fileId: string;
  fileName: string;
  mimeType: string;
  category: string;
}) {
  switch (category) {
    case "image":
      return (
        <div className="flex items-center justify-center rounded-xl border bg-black/5 dark:bg-black/40 p-2 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/serve/${fileId}`}
            alt={fileName}
            className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
          />
        </div>
      );

    case "pdf":
      return (
        <iframe
          src={`/api/files/serve/${fileId}`}
          className="w-full h-[80vh] rounded-lg border"
          title={fileName}
        />
      );

    case "video":
      return (
        <div className="flex items-center justify-center rounded-lg border bg-black p-2">
          <video
            controls
            className="max-w-full max-h-[70vh] rounded-lg"
          >
            <source src={`/api/files/serve/${fileId}`} type={mimeType} />
            Your browser does not support the video tag.
          </video>
        </div>
      );

    case "audio":
      return (
        <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-8">
          <audio controls className="w-full">
            <source src={`/api/files/serve/${fileId}`} type={mimeType} />
            Your browser does not support the audio element.
          </audio>
        </div>
      );

    case "text":
    case "code":
      return <TextPreview fileId={fileId} filename={fileName} />;

    default:
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-8 sm:p-16 text-center">
          <File className="size-16 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">{fileName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              No preview available for this file type
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={`/api/files/download/${fileId}`}>
              <Download className="size-4 mr-2" />
              Download to view
            </a>
          </Button>
        </div>
      );
  }
}
