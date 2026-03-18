"use client";

import { useState } from "react";
import { FileList } from "./file-list";
import { FileGrid } from "./file-grid";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "./ui/button";

type Props = {
  folders: Array<{
    id: string;
    name: string;
    color: string | null;
    _count: { files: number; subFolders: number };
    updatedAt: string;
  }>;
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: string;
    updatedAt: string;
    uploadedByUserId: string;
  }>;
  baseUrl: string;
  currentFolderId?: string | null;
  initialView?: string;
};

export function ViewToggleWrapper({
  folders,
  files,
  baseUrl,
  currentFolderId,
  initialView,
}: Props) {
  const [view, setView] = useState<"grid" | "list">(
    initialView === "grid" ? "grid" : "list"
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex items-center rounded-md border">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => setView("list")}
          >
            <List className="size-4" />
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="size-4" />
          </Button>
        </div>
      </div>

      {view === "grid" ? (
        <FileGrid
          folders={folders}
          files={files}
          baseUrl={baseUrl}
          currentFolderId={currentFolderId}
        />
      ) : (
        <FileList
          folders={folders}
          files={files}
          baseUrl={baseUrl}
          currentFolderId={currentFolderId}
        />
      )}
    </div>
  );
}
