"use client";

import React, { useRef, useState, useTransition } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileIcon } from "@/components/file-icon";
import { InlineRename } from "@/components/inline-rename";
import { MoveToDialog } from "@/components/move-to-dialog";
import { formatFileSize, formatDateRelative, formatMimeType } from "@/lib/format";
import {
  MoreHorizontal,
  Pencil,
  FolderInput,
  Copy,
  Download,
  Star,
  Trash2,
} from "lucide-react";
import type { SerializedFile, SerializedFolder } from "@/hooks/use-files";

type FileListProps = {
  folders: SerializedFolder[];
  files: SerializedFile[];
  baseUrl: string;
  currentFolderId?: string | null;
  selectedFileIds?: string[];
  selectedFolderIds?: string[];
  onToggleFileSelection?: (id: string) => void;
  onToggleFolderSelection?: (id: string) => void;
  isAllSelected?: boolean;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
};

const ROW_HEIGHT = 48;
const ROW_HEIGHT_EXCERPT = 72;

// Render a ts_headline excerpt — Postgres wraps matched terms in [[ and ]]
function renderHighlight(text: string): React.ReactNode {
  const parts = text.split(/(\[\[.*?\]\])/);
  return parts.map((part, i) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      return (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-[2px] px-0.5">
          {part.slice(2, -2)}
        </mark>
      );
    }
    return part;
  });
}

type ListItem =
  | { type: "folder"; data: SerializedFolder }
  | { type: "file"; data: SerializedFile };

async function callAction(actionName: string, data: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  const mod = await import("@/app/(app)/browse/actions");
  const action = (mod as Record<string, (fd: FormData) => Promise<void>>)[actionName];
  if (action) await action(formData);
}

export function FileList({
  folders,
  files,
  baseUrl,
  currentFolderId,
  selectedFileIds = [],
  selectedFolderIds = [],
  onToggleFileSelection,
  onToggleFolderSelection,
  isAllSelected,
  onSelectAll,
  onClearSelection,
}: FileListProps) {
  const hasContent = folders.length > 0 || files.length > 0;
  const hasSelection = onToggleFileSelection !== undefined;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{
    id: string;
    type: "file" | "folder";
    name: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Build flat list of items for virtualizer
  const items: ListItem[] = [
    ...folders.map((f) => ({ type: "folder" as const, data: f })),
    ...files.map((f) => ({ type: "file" as const, data: f })),
  ];

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => {
      const item = items[i];
      return item.type === "file" && item.data.excerpt ? ROW_HEIGHT_EXCERPT : ROW_HEIGHT;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 15,
  });

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        This folder is empty. Upload files or create a subfolder to get started.
      </p>
    );
  }

  const handleRenameFile = (fileId: string, newName: string) => {
    setRenamingFileId(null);
    startTransition(async () => {
      await callAction("renameFileAction", { fileId, name: newName });
      router.refresh();
    });
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    setRenamingFolderId(null);
    startTransition(async () => {
      await callAction("renameFolderAction", { folderId, name: newName });
      router.refresh();
    });
  };

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
    e.currentTarget.classList.remove("bg-accent/50");
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-accent/50");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-accent/50");
  };

  const renderFolderRow = (folder: SerializedFolder) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable={!folder.isSystem}
          onDragStart={(e) => {
            if (folder.isSystem) { e.preventDefault(); return; }
            e.dataTransfer.setData("application/x-folder-id", folder.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDrop={(e) => handleDrop(e, folder.id)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="flex items-center h-12 px-3 border-b transition-colors cursor-grab active:cursor-grabbing hover:bg-accent/30"
        >
          {hasSelection && (
            <div className="w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedFolderIds.includes(folder.id)}
                onCheckedChange={() => onToggleFolderSelection?.(folder.id)}
                aria-label={`Select ${folder.name}`}
              />
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            {renamingFolderId === folder.id ? (
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon isFolder folderColor={folder.color ?? undefined} className="shrink-0" />
                <InlineRename
                  name={folder.name}
                  onRename={(n) => handleRenameFolder(folder.id, n)}
                  onCancel={() => setRenamingFolderId(null)}
                />
              </div>
            ) : (
              <Link
                href={`${baseUrl}?folderId=${folder.id}`}
                className="flex items-center gap-2 hover:underline font-medium min-w-0"
              >
                <FileIcon isFolder folderColor={folder.color ?? undefined} className="shrink-0" />
                <span className="truncate block">{folder.name}</span>
              </Link>
            )}
          </div>
          <div className="hidden md:block w-24">
            <Badge variant="secondary">Folder</Badge>
          </div>
          <div className="hidden sm:block w-24 text-muted-foreground text-sm">
            {folder._count.files} files
          </div>
          <div className="hidden lg:block w-32" />
          <div className="hidden lg:block w-32" />
          <div className="hidden sm:block w-32 text-muted-foreground text-sm">
            {formatDateRelative(folder.updatedAt)}
          </div>
          <div className="w-10 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!folder.isSystem && (
                  <>
                    <DropdownMenuItem onClick={() => setRenamingFolderId(folder.id)}>
                      <Pencil className="size-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        setMoveTarget({ id: folder.id, type: "folder", name: folder.name })
                      }
                    >
                      <FolderInput className="size-4 mr-2" />
                      Move to...
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteFolder(folder.id)}
                    >
                      <Trash2 className="size-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {!folder.isSystem && (
          <>
            <ContextMenuItem onClick={() => setRenamingFolderId(folder.id)}>
              <Pencil className="size-4 mr-2" />
              Rename
            </ContextMenuItem>
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

  const renderFileRow = (file: SerializedFile) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-file-id", file.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          className="flex flex-col px-3 border-b transition-colors cursor-grab active:cursor-grabbing hover:bg-accent/30 min-h-12 justify-center py-1.5"
        >
          <div className="flex items-center">
            {hasSelection && (
              <div className="w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedFileIds.includes(file.id)}
                  onCheckedChange={() => onToggleFileSelection?.(file.id)}
                  aria-label={`Select ${file.name}`}
                />
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-hidden">
              {renamingFileId === file.id ? (
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon mimeType={file.mimeType} className="shrink-0" />
                  <InlineRename
                    name={file.name}
                    onRename={(n) => handleRenameFile(file.id, n)}
                    onCancel={() => setRenamingFileId(null)}
                  />
                </div>
              ) : (
                <Link
                  href={`${baseUrl}/${file.id}`}
                  className="flex items-center gap-2 hover:underline font-medium min-w-0"
                >
                  <FileIcon mimeType={file.mimeType} className="shrink-0" />
                  <span className="truncate block">{file.name}</span>
                </Link>
              )}
            </div>
          <div className="hidden md:block w-24">
            <Badge variant="secondary">{formatMimeType(file.mimeType)}</Badge>
          </div>
          <div className="hidden sm:block w-24 text-muted-foreground text-sm">
            {formatFileSize(BigInt(file.size))}
          </div>
          <div className="hidden lg:block w-32">
            {file.tags && file.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {file.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                    style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="hidden lg:block w-32 text-muted-foreground text-xs">
            {file.uploadedByName || "—"}
          </div>
          <div className="hidden sm:block w-32 text-muted-foreground text-sm">
            {formatDateRelative(file.updatedAt)}
          </div>
          <div className="w-10 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenamingFileId(file.id)}>
                  <Pencil className="size-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setMoveTarget({ id: file.id, type: "file", name: file.name })
                  }
                >
                  <FolderInput className="size-4 mr-2" />
                  Move to...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopyFile(file.id)}>
                  <Copy className="size-4 mr-2" />
                  Make a copy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFavorite(file.id)}>
                  <Star className="size-4 mr-2" />
                  Favorite
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/files/download/${file.id}`}>
                    <Download className="size-4 mr-2" />
                    Download
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDeleteFile(file.id)}
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>{/* end inner flex row */}
          {file.excerpt && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 pl-6 pr-12">
              {renderHighlight(file.excerpt)}
            </p>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => setRenamingFileId(file.id)}>
          <Pencil className="size-4 mr-2" />
          Rename
        </ContextMenuItem>
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

  return (
    <>
      <div className={`rounded-md border ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
        {/* Table header */}
        <div className="flex items-center h-10 px-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          {hasSelection && (
            <div className="w-10 shrink-0">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={() => isAllSelected ? onClearSelection?.() : onSelectAll?.()}
                aria-label="Select all"
              />
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">Name</div>
          <div className="hidden md:block w-24">Type</div>
          <div className="hidden sm:block w-24">Size</div>
          <div className="hidden lg:block w-32">Tags</div>
          <div className="hidden lg:block w-32">Uploaded by</div>
          <div className="hidden sm:block w-32">Modified</div>
          <div className="w-10 shrink-0" />
        </div>

        {/* Virtualized rows */}
        <div
          ref={scrollRef}
          className="h-[calc(100svh-240px)] sm:h-[calc(100vh-300px)] md:h-[calc(100vh-340px)] overflow-auto"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {item.type === "folder"
                    ? renderFolderRow(item.data)
                    : renderFileRow(item.data)}
                </div>
              );
            })}
          </div>
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
