"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  FolderInput,
  Star,
  Trash2,
  Download,
  X,
} from "lucide-react";

type Props = {
  selectedFileIds: string[];
  selectedFolderIds: string[];
  onClear: () => void;
  onMoveRequest: () => void;
  currentFolderId?: string | null;
};

export function BulkActionsBar({
  selectedFileIds,
  selectedFolderIds,
  onClear,
  onMoveRequest,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const totalSelected = selectedFileIds.length + selectedFolderIds.length;

  const handleBulkDelete = () => {
    startTransition(async () => {
      const mod = await import("@/app/(app)/browse/actions");
      if (selectedFileIds.length > 0) {
        const fd = new FormData();
        fd.append("fileIds", JSON.stringify(selectedFileIds));
        await mod.deleteFilesAction(fd);
      }
      if (selectedFolderIds.length > 0) {
        const fd = new FormData();
        fd.append("folderIds", JSON.stringify(selectedFolderIds));
        await mod.bulkDeleteFoldersAction(fd);
      }
      onClear();
      router.refresh();
    });
  };

  const handleBulkFavorite = () => {
    if (selectedFileIds.length === 0) return;
    startTransition(async () => {
      const mod = await import("@/app/(app)/browse/actions");
      const fd = new FormData();
      fd.append("fileIds", JSON.stringify(selectedFileIds));
      await mod.bulkFavoriteFilesAction(fd);
      onClear();
      router.refresh();
    });
  };

  const handleBulkDownload = () => {
    // Download files one by one (no zip support yet)
    for (const fileId of selectedFileIds) {
      const a = document.createElement("a");
      a.href = `/api/files/download/${fileId}`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 rounded-lg border bg-accent/30 px-3 sm:px-4 py-2.5">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-sm font-medium tabular-nums">
          {totalSelected} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <div className={`flex items-center gap-0.5 sm:gap-1 ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 sm:h-8 text-xs gap-1.5"
            onClick={onMoveRequest}
            title="Move"
          >
            <FolderInput className="size-4 sm:size-3.5" />
            <span className="hidden sm:inline">Move</span>
          </Button>
          {selectedFileIds.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 sm:h-8 text-xs gap-1.5"
                onClick={handleBulkFavorite}
                title="Favorite"
              >
                <Star className="size-4 sm:size-3.5" />
                <span className="hidden sm:inline">Favorite</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 sm:h-8 text-xs gap-1.5"
                onClick={handleBulkDownload}
                title="Download"
              >
                <Download className="size-4 sm:size-3.5" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 sm:h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
            onClick={handleBulkDelete}
            title="Delete"
          >
            <Trash2 className="size-4 sm:size-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="h-9 sm:h-8" onClick={onClear}>
        <X className="size-4 sm:size-3.5 mr-1" />
        Clear
      </Button>
    </div>
  );
}
