"use client";

import { useMemo } from "react";
import { useFiles } from "@/hooks/use-files";
import { useQueryClient } from "@tanstack/react-query";
import { formatFileSize, formatDateRelative } from "@/lib/format";
import { FileIcon } from "@/components/file-icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";

export function TrashClient() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useFiles({
    status: "DELETED",
    limit: 200,
  });

  const trashedFiles = useMemo(
    () => data?.pages.flatMap((p) => p.files) ?? [],
    [data]
  );

  const trashedFolders = useMemo(
    () => data?.pages[0]?.folders ?? [],
    [data]
  );

  const hasItems = trashedFiles.length > 0 || trashedFolders.length > 0;

  const handleRestore = async (type: "file" | "folder", id: string) => {
    const mod = await import("./actions");
    const fd = new FormData();
    if (type === "file") {
      fd.append("fileId", id);
      await mod.restoreFileAction(fd);
    } else {
      fd.append("folderId", id);
      await mod.restoreFolderAction(fd);
    }
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  const handlePermanentDelete = async (fileId: string) => {
    const mod = await import("./actions");
    const fd = new FormData();
    fd.append("fileId", fileId);
    await mod.permanentDeleteFileAction(fd);
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  const handleEmptyTrash = async () => {
    const mod = await import("./actions");
    await mod.emptyTrashAction();
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
          <p className="text-muted-foreground">Deleted files and folders</p>
        </div>
        {hasItems && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEmptyTrash}
          >
            <Trash2 className="size-4 mr-2" />
            Empty Trash
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Items are permanently deleted after 30 days</span>
      </div>

      {!hasItems ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-8 sm:p-16 text-center">
          <Trash2 className="size-16 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">Trash is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Deleted files and folders will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden sm:table-cell">Size</TableHead>
                <TableHead className="hidden md:table-cell">Deleted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trashedFolders.map((folder) => (
                <TableRow key={`folder-${folder.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileIcon
                        isFolder
                        folderColor={folder.color ?? undefined}
                        className="size-5 shrink-0"
                      />
                      <span className="truncate">{folder.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline">Folder</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    --
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDateRelative(folder.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Restore"
                        onClick={() => handleRestore("folder", folder.id)}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {trashedFiles.map((file) => (
                <TableRow key={`file-${file.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileIcon
                        mimeType={file.mimeType}
                        className="size-5 shrink-0"
                      />
                      <span className="truncate">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">File</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {formatFileSize(BigInt(file.size))}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDateRelative(file.deletedAt ?? file.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Restore"
                        onClick={() => handleRestore("file", file.id)}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title="Delete permanently"
                        onClick={() => handlePermanentDelete(file.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
