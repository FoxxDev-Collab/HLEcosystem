"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileList } from "./file-list";
import { FileGrid } from "./file-grid";
import { BulkActionsBar } from "./bulk-actions-bar";
import { MoveToDialog } from "./move-to-dialog";
import { UploadDropzone } from "./upload-dropzone";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Tag,
  Loader2,
} from "lucide-react";
import type { SerializedFile, SerializedFolder } from "@/hooks/use-files";

type TagInfo = { id: string; name: string; color: string | null };

type SortField = "name" | "size" | "date" | "type";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "image" | "video" | "audio" | "pdf" | "document" | "archive" | "code" | "other";

type Props = {
  folders: SerializedFolder[];
  files: SerializedFile[];
  allTags: TagInfo[];
  baseUrl: string;
  currentFolderId?: string | null;
  initialView?: string;
  activeTagFilter?: string | null;
  showUploadDropzone?: boolean;
  uploadFolderId?: string | null;
  uploadIsPersonal?: boolean;
  // Pagination props from TanStack Query
  totalCount?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
};

const SORT_LABELS: Record<SortField, string> = {
  name: "Name",
  size: "Size",
  date: "Date modified",
  type: "Type",
};

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All types",
  image: "Images",
  video: "Videos",
  audio: "Audio",
  pdf: "PDFs",
  document: "Documents",
  archive: "Archives",
  code: "Code",
  other: "Other",
};

export function ViewToggleWrapper({
  folders,
  files,
  allTags,
  baseUrl,
  currentFolderId,
  initialView,
  activeTagFilter,
  showUploadDropzone,
  uploadFolderId,
  uploadIsPersonal,
  totalCount = 0,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<"grid" | "list">(
    initialView === "grid" ? "grid" : "list"
  );
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);

  // Read current sort/filter from URL (these drive the API query)
  const sortField = (searchParams.get("sort") || "date") as SortField;
  const sortDir = (searchParams.get("dir") || "desc") as SortDir;
  const typeFilter = (searchParams.get("type") || "all") as TypeFilter;

  // Update URL params — this triggers a new API fetch via useFiles query key change
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "" || (key === "type" && value === "all")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${baseUrl}?${params.toString()}`);
    },
    [searchParams, router, baseUrl]
  );

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      updateParam("dir", sortDir === "asc" ? "desc" : "asc");
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", field);
      params.set("dir", field === "name" || field === "type" ? "asc" : "desc");
      router.push(`${baseUrl}?${params.toString()}`);
    }
  };

  const handleTypeFilter = (value: string) => {
    updateParam("type", value === "all" ? null : value);
  };

  const handleTagFilter = (tagId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tag", tagId);
    params.delete("q");
    params.delete("folderId");
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const clearTagFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tag");
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("type");
    params.delete("tag");
    params.delete("q");
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  }, []);

  const toggleFolderSelection = useCallback((folderId: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedFileIds(files.map((f) => f.id));
    setSelectedFolderIds(folders.map((f) => f.id));
  }, [files, folders]);

  const clearSelection = useCallback(() => {
    setSelectedFileIds([]);
    setSelectedFolderIds([]);
  }, []);

  const handleBulkMove = useCallback(
    (_itemId: string, targetFolderId: string) => {
      const doMove = async () => {
        const mod = await import("@/app/(app)/browse/actions");
        const fd = new FormData();
        fd.append("fileIds", JSON.stringify(selectedFileIds));
        fd.append("folderIds", JSON.stringify(selectedFolderIds));
        fd.append("targetFolderId", targetFolderId);
        await mod.bulkMoveFilesAction(fd);
        clearSelection();
        router.refresh();
      };
      doMove();
    },
    [selectedFileIds, selectedFolderIds, clearSelection, router]
  );

  const hasAnySelected = selectedFileIds.length > 0 || selectedFolderIds.length > 0;

  const isAllSelected =
    folders.length + files.length > 0 &&
    selectedFileIds.length === files.length &&
    selectedFolderIds.length === folders.length;

  const activeFiltersCount =
    (typeFilter !== "all" ? 1 : 0) + (activeTagFilter ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 sm:h-8 text-xs gap-1.5">
                {sortDir === "asc" ? (
                  <ArrowUp className="size-3.5" />
                ) : (
                  <ArrowDown className="size-3.5" />
                )}
                <span className="hidden sm:inline">{SORT_LABELS[sortField]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sortField}
                onValueChange={(v) => handleSortChange(v as SortField)}
              >
                <DropdownMenuRadioItem value="name" className="text-xs">Name</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="size" className="text-xs">Size</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date" className="text-xs">Date modified</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="type" className="text-xs">Type</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sortDir}
                onValueChange={(v) => updateParam("dir", v)}
              >
                <DropdownMenuRadioItem value="asc" className="text-xs">
                  <ArrowUp className="size-3 mr-1.5" />
                  Ascending
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc" className="text-xs">
                  <ArrowDown className="size-3 mr-1.5" />
                  Descending
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={typeFilter !== "all" ? "default" : "outline"}
                size="sm"
                className="h-9 sm:h-8 text-xs gap-1.5"
              >
                <Filter className="size-3.5" />
                <span className="hidden sm:inline">{typeFilter === "all" ? "Type" : TYPE_LABELS[typeFilter]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs">Filter by type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={typeFilter}
                onValueChange={handleTypeFilter}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value} className="text-xs">
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={activeTagFilter ? "default" : "outline"}
                  size="sm"
                  className="h-9 sm:h-8 text-xs gap-1.5"
                >
                  <Tag className="size-3.5" />
                  <span className="hidden sm:inline">Tag</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs">Filter by tag</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {activeTagFilter && (
                  <>
                    <button
                      onClick={clearTagFilter}
                      className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
                    >
                      <X className="size-3" />
                      Clear filter
                    </button>
                    <DropdownMenuSeparator />
                  </>
                )}
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagFilter(tag.id)}
                    className={`flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs hover:bg-accent ${
                      activeTagFilter === tag.id ? "bg-accent font-medium" : ""
                    }`}
                  >
                    <div
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color || "#6b7280" }}
                    />
                    {tag.name}
                  </button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Active filters indicator */}
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3" />
              Clear filters
            </button>
          )}
        </div>

        {/* View toggle + count */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
            {totalCount} file{totalCount !== 1 ? "s" : ""}
            {folders.length > 0 && `, ${folders.length} folder${folders.length !== 1 ? "s" : ""}`}
          </span>
          <div className="flex items-center rounded-md border">
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none h-9 sm:h-8"
              onClick={() => setView("list")}
            >
              <List className="size-4" />
            </Button>
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none h-9 sm:h-8"
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active tag filter pill */}
      {activeTagFilter && (
        <div className="flex items-center gap-2">
          {allTags
            .filter((t) => t.id === activeTagFilter)
            .map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="gap-1 pr-1"
                style={tag.color ? { borderColor: tag.color } : undefined}
              >
                <div
                  className="size-2 rounded-full"
                  style={{ backgroundColor: tag.color || "#6b7280" }}
                />
                {tag.name}
                <button
                  onClick={clearTagFilter}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
        </div>
      )}

      {/* Upload dropzone OR bulk actions bar */}
      {hasAnySelected ? (
        <BulkActionsBar
          selectedFileIds={selectedFileIds}
          selectedFolderIds={selectedFolderIds}
          onClear={clearSelection}
          onMoveRequest={() => setBulkMoveOpen(true)}
          currentFolderId={currentFolderId}
        />
      ) : showUploadDropzone ? (
        <UploadDropzone folderId={uploadFolderId} isPersonal={uploadIsPersonal} />
      ) : null}

      {/* Content */}
      {view === "grid" ? (
        <FileGrid
          folders={folders}
          files={files}
          baseUrl={baseUrl}
          currentFolderId={currentFolderId}
          selectedFileIds={selectedFileIds}
          selectedFolderIds={selectedFolderIds}
          onToggleFileSelection={toggleFileSelection}
          onToggleFolderSelection={toggleFolderSelection}
        />
      ) : (
        <FileList
          folders={folders}
          files={files}
          baseUrl={baseUrl}
          currentFolderId={currentFolderId}
          selectedFileIds={selectedFileIds}
          selectedFolderIds={selectedFolderIds}
          onToggleFileSelection={toggleFileSelection}
          onToggleFolderSelection={toggleFolderSelection}
          isAllSelected={isAllSelected}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
        />
      )}

      {/* Load more / infinite scroll trigger */}
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onLoadMore?.()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more files"
            )}
          </Button>
        </div>
      )}

      {bulkMoveOpen && (
        <MoveToDialog
          open={bulkMoveOpen}
          onOpenChange={(open) => !open && setBulkMoveOpen(false)}
          title={`Move ${selectedFileIds.length + selectedFolderIds.length} items`}
          itemId="bulk"
          itemType="file"
          currentFolderId={currentFolderId}
          onMove={handleBulkMove}
          baseUrl={baseUrl}
        />
      )}
    </div>
  );
}
