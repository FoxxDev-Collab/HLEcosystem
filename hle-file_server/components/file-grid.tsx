"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileIcon } from "@/components/file-icon";
import { MoveToDialog } from "@/components/move-to-dialog";
import { formatFileSize, formatMimeType } from "@/lib/format";
import {
  FolderInput,
  Copy,
  Download,
  Star,
  Trash2,
  Play,
} from "lucide-react";
import type { SerializedFile, SerializedFolder } from "@/hooks/use-files";

type FileGridProps = {
  folders: SerializedFolder[];
  files: SerializedFile[];
  baseUrl: string;
  currentFolderId?: string | null;
  selectedFileIds?: string[];
  selectedFolderIds?: string[];
  onToggleFileSelection?: (id: string) => void;
  onToggleFolderSelection?: (id: string) => void;
};

const CARD_HEIGHT = 180;
const GAP = 8;

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

async function callAction(actionName: string, data: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  const mod = await import("@/app/(app)/browse/actions");
  const action = (mod as Record<string, (fd: FormData) => Promise<void>>)[actionName];
  if (action) await action(formData);
}

export function FileGrid({
  folders,
  files,
  baseUrl,
  currentFolderId,
  selectedFileIds = [],
  selectedFolderIds = [],
  onToggleFileSelection,
  onToggleFolderSelection,
}: FileGridProps) {
  const hasSelection = onToggleFileSelection !== undefined;
  const allItems = [
    ...folders.map((f) => ({ type: "folder" as const, ...f })),
    ...files.map((f) => ({ type: "file" as const, ...f })),
  ];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [moveTarget, setMoveTarget] = useState<{
    id: string;
    type: "file" | "folder";
    name: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(6);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width >= 1280) setColumns(6);
      else if (width >= 1024) setColumns(5);
      else if (width >= 768) setColumns(4);
      else if (width >= 640) setColumns(3);
      else setColumns(2);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(allItems.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT + GAP,
    overscan: 3,
  });

  if (allItems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        This folder is empty. Upload files or create a subfolder to get started.
      </p>
    );
  }

  const handleDeleteFile = (fileId: string) => {
    startTransition(async () => {
      await callAction("deleteFileAction", { fileId });
      router.refresh();
    });
  };

  const handleDeleteFolder = (folderId: string) => {
    startTransition(async () => {
      await callAction("deleteFolderAction", { folderId });
      router.refresh();
    });
  };

  const handleCopyFile = (fileId: string) => {
    startTransition(async () => {
      await callAction("copyFileAction", {
        fileId,
        targetFolderId: currentFolderId ?? "",
      });
      router.refresh();
    });
  };

  const handleFavorite = (fileId: string) => {
    startTransition(async () => {
      const mod = await import("@/app/(app)/favorites/actions");
      const fd = new FormData();
      fd.append("fileId", fileId);
      await mod.toggleFavoriteAction(fd);
      router.refresh();
    });
  };

  const handleMove = (itemId: string, targetFolderId: string) => {
    if (!moveTarget) return;
    startTransition(async () => {
      if (moveTarget.type === "file") {
        await callAction("moveFileAction", { fileId: itemId, targetFolderId });
      } else {
        await callAction("moveFolderAction", {
          folderId: itemId,
          targetParentFolderId: targetFolderId,
        });
      }
      setMoveTarget(null);
      router.refresh();
    });
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("ring-2", "ring-primary");
    const fileId = e.dataTransfer.getData("application/x-file-id");
    const folderId = e.dataTransfer.getData("application/x-folder-id");

    if (fileId) {
      startTransition(async () => {
        await callAction("moveFileAction", { fileId, targetFolderId });
        router.refresh();
      });
    } else if (folderId && folderId !== targetFolderId) {
      startTransition(async () => {
        await callAction("moveFolderAction", {
          folderId,
          targetParentFolderId: targetFolderId,
        });
        router.refresh();
      });
    }
  };

  const renderFolderCard = (folder: SerializedFolder) => (
    <ContextMenu key={folder.id}>
      <ContextMenuTrigger asChild>
        <Link
          href={`${baseUrl}?folderId=${folder.id}`}
          draggable={!folder.isSystem}
          onDragStart={(e) => {
            if (folder.isSystem) { e.preventDefault(); return; }
            e.dataTransfer.setData("application/x-folder-id", folder.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDrop={(e) => handleDrop(e, folder.id)}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("ring-2", "ring-primary");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("ring-2", "ring-primary");
          }}
          className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border p-4 hover:bg-accent/50 transition-all cursor-grab active:cursor-grabbing h-full ${
            selectedFolderIds.includes(folder.id)
              ? "ring-2 ring-primary bg-primary/5"
              : ""
          }`}
        >
          {hasSelection && (
            <div
              className="absolute top-2.5 left-2.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              style={
                selectedFolderIds.includes(folder.id) ? { opacity: 1 } : undefined
              }
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFolderSelection?.(folder.id);
              }}
            >
              <Checkbox
                checked={selectedFolderIds.includes(folder.id)}
                aria-label={`Select ${folder.name}`}
              />
            </div>
          )}
          <FileIcon
            isFolder
            folderColor={folder.color ?? undefined}
            className="size-10"
          />
          <span className="text-sm font-medium text-center truncate w-full">
            {folder.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {folder._count.files} file{folder._count.files !== 1 ? "s" : ""}
          </span>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {!folder.isSystem && (
          <>
            <ContextMenuItem
              onClick={() =>
                setMoveTarget({ id: folder.id, type: "folder", name: folder.name })
              }
            >
              <FolderInput className="size-4 mr-2" />
              Move to...
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive"
              onClick={() => handleDeleteFolder(folder.id)}
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );

  const renderFileCard = (file: SerializedFile) => {
    const isImage = isImageMime(file.mimeType);
    const isVideo = isVideoMime(file.mimeType);
    const hasThumb = isImage || isVideo;

    return (
      <ContextMenu key={file.id}>
        <ContextMenuTrigger asChild>
          <Link
            href={`${baseUrl}/${file.id}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-file-id", file.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            className={`group relative flex flex-col rounded-xl border overflow-hidden hover:shadow-md transition-all cursor-grab active:cursor-grabbing h-full ${
              selectedFileIds.includes(file.id)
                ? "ring-2 ring-primary bg-primary/5"
                : ""
            }`}
          >
            {hasSelection && (
              <div
                className="absolute top-2.5 left-2.5 z-10 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                style={
                  selectedFileIds.includes(file.id) ? { opacity: 1 } : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFileSelection?.(file.id);
                }}
              >
                <Checkbox
                  checked={selectedFileIds.includes(file.id)}
                  aria-label={`Select ${file.name}`}
                  className={hasThumb ? "border-white/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}
                />
              </div>
            )}

            {/* Thumbnail area */}
            {hasThumb ? (
              <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                {isVideo ? (
                  <>
                    <video
                      src={`/api/files/serve/${file.id}`}
                      muted
                      preload="metadata"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex items-center justify-center size-8 rounded-full bg-black/50 text-white">
                        <Play className="size-4 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/files/thumbnail/${file.id}`}
                    alt={file.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                {/* Gradient overlay for tags */}
                {file.tags && file.tags.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2 pt-4">
                    <div className="flex flex-wrap gap-0.5">
                      {file.tags.slice(0, 3).map((tag) => (
                        <div
                          key={tag.id}
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: tag.color || "#fff" }}
                          title={tag.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center aspect-[4/3] bg-muted/40">
                <FileIcon mimeType={file.mimeType} className="size-10 opacity-60" />
              </div>
            )}

            {/* File info */}
            <div className="flex-1 flex flex-col justify-center p-3 min-w-0">
              <span className="text-xs font-medium truncate leading-tight">
                {file.name}
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-muted-foreground">
                  {formatMimeType(file.mimeType)}
                </span>
                <span className="text-[10px] text-muted-foreground/50">&middot;</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatFileSize(BigInt(file.size))}
                </span>
              </div>
            </div>
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() =>
              setMoveTarget({ id: file.id, type: "file", name: file.name })
            }
          >
            <FolderInput className="size-4 mr-2" />
            Move to...
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleCopyFile(file.id)}>
            <Copy className="size-4 mr-2" />
            Make a copy
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleFavorite(file.id)}>
            <Star className="size-4 mr-2" />
            Favorite
          </ContextMenuItem>
          <ContextMenuItem asChild>
            <a href={`/api/files/download/${file.id}`}>
              <Download className="size-4 mr-2" />
              Download
            </a>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive"
            onClick={() => handleDeleteFile(file.id)}
          >
            <Trash2 className="size-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <>
      <div
        ref={scrollRef}
        className={`h-[calc(100vh-280px)] overflow-auto fs-scroll ${
          isPending ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * columns;
            const rowItems = allItems.slice(startIndex, startIndex + columns);

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  }}
                >
                  {rowItems.map((item) =>
                    item.type === "folder"
                      ? renderFolderCard(item as unknown as SerializedFolder)
                      : renderFileCard(item as unknown as SerializedFile)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {moveTarget && (
        <MoveToDialog
          open={!!moveTarget}
          onOpenChange={(open) => !open && setMoveTarget(null)}
          title={`Move "${moveTarget.name}"`}
          itemId={moveTarget.id}
          itemType={moveTarget.type}
          currentFolderId={currentFolderId}
          onMove={handleMove}
          baseUrl={baseUrl}
        />
      )}
    </>
  );
}
