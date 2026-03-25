import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDateRelative } from "@/lib/format";
import { Album, Plus, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateAlbumDialog } from "@/components/create-album-dialog";

export default async function AlbumsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const albums = await prisma.album.findMany({
    where: { householdId },
    include: {
      _count: { select: { files: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Albums</h1>
          <p className="text-muted-foreground text-sm">
            {albums.length} album{albums.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateAlbumDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4 mr-1.5" />
              New Album
            </Button>
          }
        />
      </div>

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Album className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No albums yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Create albums to organize your photos into collections.
          </p>
          <CreateAlbumDialog
            trigger={
              <Button>
                <Plus className="size-4 mr-2" />
                Create your first album
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.id}`}
              className="group"
            >
              <div className="album-card bg-muted">
                {album.coverFileId ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/files/thumbnail/${album.coverFileId}`}
                    alt={album.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Image className="size-10 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
                  <p className="text-white font-semibold text-sm leading-tight truncate">
                    {album.name}
                  </p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {album._count.files} item{album._count.files !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
