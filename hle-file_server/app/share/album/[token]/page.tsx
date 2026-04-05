import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Album, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function SharedAlbumPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const shareLink = await prisma.albumShareLink.findUnique({
    where: { token },
    include: {
      album: {
        include: {
          files: {
            include: {
              file: {
                select: {
                  id: true,
                  name: true,
                  mimeType: true,
                  size: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!shareLink || !shareLink.isActive) notFound();

  if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <Album className="size-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold">Link Expired</h1>
          <p className="text-sm text-muted-foreground">This album share link has expired.</p>
        </div>
      </div>
    );
  }

  const { album } = shareLink;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{album.name}</h1>
          {album.description && (
            <p className="text-muted-foreground text-sm mt-1">{album.description}</p>
          )}
          <p className="text-muted-foreground text-xs mt-2">
            {album.files.length} photo{album.files.length !== 1 ? "s" : ""} &middot; Shared album
          </p>
        </div>

        {album.files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Album className="size-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">This album is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {album.files.map((af) => (
              <div key={af.file.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                {af.file.mimeType.startsWith("video/") ? (
                  <video
                    src={`/api/files/serve/${af.file.id}`}
                    muted
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/files/thumbnail/${af.file.id}`}
                    alt={af.file.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                  <div className="w-full p-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                    <span className="text-white text-xs truncate">{af.file.name}</span>
                    <a href={`/api/files/download/${af.file.id}`}>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:text-white hover:bg-white/20">
                        <Download className="size-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
