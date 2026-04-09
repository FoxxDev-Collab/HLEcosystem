"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, ChevronRight, CornerUpLeft } from "lucide-react";

type FolderOption = {
  id: string;
  name: string;
  color: string | null;
  parentFolderId: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemId: string;
  itemType: "file" | "folder";
  currentFolderId?: string | null;
  onMove: (itemId: string, targetFolderId: string) => void;
  baseUrl: string;
};

export function MoveToDialog({
  open,
  onOpenChange,
  title,
  itemId,
  onMove,
  currentFolderId,
}: Props) {
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [loading, startLoadTransition] = useTransition();

  // Previously flipped a manual `loading` state synchronously inside the
  // effect, which React 19's react-hooks/set-state-in-effect rule forbids.
  // useTransition exposes a pending flag that doesn't require synchronous
  // setState in the effect body.
  useEffect(() => {
    if (!open) return;
    startLoadTransition(async () => {
      try {
        const r = await fetch(`/api/files/folders?parentFolderId=${browseFolderId ?? ""}`);
        const data = await r.json();
        setFolders(data.folders ?? []);
      } catch {
        setFolders([]);
      }
    });
  }, [open, browseFolderId]);

  const handleMove = () => {
    onMove(itemId, browseFolderId ?? "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {browseFolderId && (
            <button
              onClick={() => setBrowseFolderId(null)}
              className="flex items-center gap-2 w-full p-2 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              <CornerUpLeft className="size-4" />
              Back to root
            </button>
          )}

          <div className="border rounded-md max-h-64 overflow-y-auto">
            <button
              onClick={handleMove}
              className={`flex items-center gap-2 w-full p-3 text-sm hover:bg-accent transition-colors border-b ${
                !browseFolderId ? "bg-accent/50 font-medium" : ""
              }`}
            >
              <Folder className="size-4 text-muted-foreground" />
              {browseFolderId ? "Current folder" : "Root (no folder)"}
            </button>

            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              folders
                .filter((f) => f.id !== currentFolderId)
                .map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center hover:bg-accent transition-colors"
                  >
                    <button
                      onClick={() => {
                        setBrowseFolderId(folder.id);
                      }}
                      className="flex items-center gap-2 flex-1 p-3 text-sm"
                    >
                      <Folder
                        className="size-4 shrink-0"
                        style={
                          folder.color ? { color: folder.color } : undefined
                        }
                      />
                      <span className="truncate">{folder.name}</span>
                    </button>
                    <button
                      onClick={() => setBrowseFolderId(folder.id)}
                      className="p-3 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                ))
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleMove}>Move here</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
