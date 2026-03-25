"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Image,
  ImageOff,
} from "lucide-react";
import {
  deleteAlbumAction,
  removeFileFromAlbumAction,
  setAlbumCoverAction,
} from "@/app/(app)/albums/actions";

type AlbumFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdAt: string;
};

type AlbumData = {
  id: string;
  name: string;
  description: string | null;
  coverFileId: string | null;
  createdAt: string;
  updatedAt: string;
  files: AlbumFile[];
};

type Props = {
  album: AlbumData;
};

export function AlbumDetailClient({ album }: Props) {
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handlePhotoClick = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleDeleteAlbum = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("albumId", album.id);
      await deleteAlbumAction(fd);
    });
  };

  const handleRemoveFile = (fileId: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("albumId", album.id);
      fd.append("fileId", fileId);
      await removeFileFromAlbumAction(fd);
      router.refresh();
    });
  };

  const handleSetCover = (fileId: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("albumId", album.id);
      fd.append("fileId", fileId);
      await setAlbumCoverAction(fd);
      router.refresh();
    });
  };

  return (
    <div className={`space-y-6 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Back link */}
      <Link
        href="/albums"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Albums
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{album.name}</h1>
          {album.description && (
            <p className="text-muted-foreground text-sm mt-1">{album.description}</p>
          )}
          <p className="text-muted-foreground text-xs mt-1">
            {album.files.length} item{album.files.length !== 1 ? "s" : ""}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <Pencil className="size-4 mr-2" />
              Edit album
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4 mr-2" />
              Delete album
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Empty state */}
      {album.files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <Image className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">Album is empty</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Add photos from the Photos page or file browser to fill this album.
          </p>
        </div>
      )}

      {/* Photo grid */}
      {album.files.length > 0 && (
        <div className="photo-grid">
          {album.files.map((file, index) => (
            <div
              key={file.id}
              className="photo-grid-item photo-animate-in group/item"
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              {file.mimeType.startsWith("video/") ? (
                <video
                  src={`/api/files/serve/${file.id}`}
                  muted
                  preload="metadata"
                  className="w-full h-full object-cover"
                  onClick={() => handlePhotoClick(index)}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/files/thumbnail/${file.id}`}
                  alt={file.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onClick={() => handlePhotoClick(index)}
                />
              )}
              <div className="select-overlay" />

              {/* Item actions - top right */}
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center size-7 rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white">
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSetCover(file.id)}>
                      <Image className="size-4 mr-2" />
                      Set as cover
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleRemoveFile(file.id)}
                    >
                      <ImageOff className="size-4 mr-2" />
                      Remove from album
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Cover indicator */}
              {file.id === album.coverFileId && (
                <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
                  Cover
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <PhotoLightbox
        files={album.files}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete album?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the album &quot;{album.name}&quot;. The photos in the album
              will not be deleted — they will remain in your files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAlbum}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Album
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
