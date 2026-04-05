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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Image,
  ImageOff,
  Link2,
  Copy,
  Check,
  X,
  Clock,
} from "lucide-react";
import {
  deleteAlbumAction,
  removeFileFromAlbumAction,
  setAlbumCoverAction,
  createAlbumShareLinkAction,
  revokeAlbumShareLinkAction,
} from "@/app/(app)/albums/actions";

type AlbumFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdAt: string;
};

type AlbumShareLink = {
  id: string;
  token: string;
  expiresAt: string | null;
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
  shareLinks: AlbumShareLink[];
};

type Props = {
  album: AlbumData;
};

export function AlbumDetailClient({ album }: Props) {
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [linkExpires, setLinkExpires] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

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

  const handleCreateShareLink = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("albumId", album.id);
      if (linkExpires) fd.append("expiresAt", linkExpires);
      await createAlbumShareLinkAction(fd);
      setShowCreateLink(false);
      setLinkExpires("");
      router.refresh();
    });
  };

  const handleRevokeShareLink = (linkId: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("linkId", linkId);
      await revokeAlbumShareLinkAction(fd);
      router.refresh();
    });
  };

  const copyAlbumLink = (token: string) => {
    const url = `${window.location.origin}/share/album/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
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
        <div className="flex items-center gap-2">
          {/* Share button */}
          <Popover open={showCreateLink} onOpenChange={setShowCreateLink}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Link2 className="size-4 mr-1.5" />
                Share Album
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
              <div className="space-y-3">
                <div className="text-sm font-medium">Create share link</div>
                <p className="text-xs text-muted-foreground">
                  Anyone with the link can view this album and its photos.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expires (optional)</Label>
                  <Input
                    type="date"
                    value={linkExpires}
                    onChange={(e) => setLinkExpires(e.target.value)}
                    className="h-8 text-xs"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={handleCreateShareLink}
                >
                  Create Link
                </Button>
              </div>
            </PopoverContent>
          </Popover>

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
      </div>

      {/* Active share links */}
      {album.shareLinks.length > 0 && (
        <div className="space-y-2">
          {album.shareLinks.map((link) => {
            const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
            return (
              <div
                key={link.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Album share link</span>
                  {isExpired && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Expired</Badge>}
                  {link.expiresAt && !isExpired && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-2.5" />
                      Expires {new Date(link.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyAlbumLink(link.token)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                    title="Copy link"
                  >
                    {copiedToken === link.token ? (
                      <Check className="size-3.5 text-green-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRevokeShareLink(link.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive"
                    title="Revoke"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
