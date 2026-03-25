"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Image,
  Loader2,
  Upload,
  Plus,
  CheckSquare,
  X,
  Star,
  FolderInput,
  Trash2,
} from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";
import type { TimelineGroup, TimelineFile } from "@/app/api/photos/timeline/route";

type Props = {
  userId: string;
  photosFolderId: string;
};

async function fetchTimeline(cursor: string | null): Promise<{
  timeline: TimelineGroup[];
  nextCursor: string | null;
  totalPhotos: number;
}> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", "100");
  const res = await fetch(`/api/photos/timeline?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch photos");
  return res.json();
}

export function PhotosClient({ userId, photosFolderId }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["photos-timeline"],
      queryFn: ({ pageParam }) => fetchTimeline(pageParam ?? null),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 30_000,
    });

  // Flatten all files for lightbox navigation
  const allFiles = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) =>
      page.timeline.flatMap((group) => group.files)
    );
  }, [data]);

  const totalPhotos = data?.pages[0]?.totalPhotos ?? 0;

  // Flatten timeline groups across pages
  const timelineGroups = useMemo(() => {
    if (!data) return [];
    const merged = new Map<string, TimelineGroup>();
    for (const page of data.pages) {
      for (const group of page.timeline) {
        if (merged.has(group.date)) {
          const existing = merged.get(group.date)!;
          existing.files = [...existing.files, ...group.files];
        } else {
          merged.set(group.date, { ...group });
        }
      }
    }
    return Array.from(merged.values());
  }, [data]);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleSelection = useCallback((fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const getGlobalIndex = useCallback(
    (fileId: string) => {
      return allFiles.findIndex((f) => f.id === fileId);
    },
    [allFiles]
  );

  const handlePhotoClick = useCallback(
    (file: TimelineFile) => {
      if (selectionMode) {
        toggleSelection(file.id);
      } else {
        const idx = getGlobalIndex(file.id);
        if (idx >= 0) setLightboxIndex(idx);
      }
    },
    [selectionMode, toggleSelection, getGlobalIndex]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Photos</h1>
          <p className="text-muted-foreground text-sm">
            {totalPhotos > 0
              ? `${totalPhotos.toLocaleString()} photo${totalPhotos !== 1 ? "s" : ""} & videos`
              : "Your photo library"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                <X className="size-4 mr-1.5" />
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode(true)}
              >
                <CheckSquare className="size-4 mr-1.5" />
                Select
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpload(!showUpload)}
              >
                <Upload className="size-4 mr-1.5" />
                Upload
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Selection actions bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium mr-2">
            {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <Button variant="ghost" size="sm" className="h-8 text-xs">
            <Star className="size-3.5 mr-1.5" />
            Favorite
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs">
            <Plus className="size-3.5 mr-1.5" />
            Add to album
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs">
            <FolderInput className="size-3.5 mr-1.5" />
            Move
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">
            <Trash2 className="size-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      )}

      {/* Upload area */}
      {showUpload && (
        <UploadDropzone folderId={photosFolderId} isPersonal={false} />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <div className="photo-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded" />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && allFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Image className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No photos yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Upload photos and videos to see them organized in a timeline.
            Images and videos from your files will appear here automatically.
          </p>
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="size-4 mr-2" />
            Upload photos
          </Button>
        </div>
      )}

      {/* Timeline view */}
      {timelineGroups.map((group) => (
        <div key={group.date}>
          <div className="timeline-header">
            <span>{group.label}</span>
            <span className="text-muted-foreground font-normal ml-2 text-xs">
              {group.files.length} item{group.files.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="photo-grid">
            {group.files.map((file, i) => (
              <div
                key={file.id}
                className={`photo-grid-item photo-animate-in ${
                  selectedIds.has(file.id) ? "selected" : ""
                }`}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                onClick={() => handlePhotoClick(file)}
              >
                {file.mimeType.startsWith("video/") ? (
                  <video
                    src={`/api/files/serve/${file.id}`}
                    muted
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/files/thumbnail/${file.id}`}
                    alt={file.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="select-overlay" />
                {/* Selection checkbox */}
                {(selectionMode || selectedIds.has(file.id)) && (
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={selectedIds.has(file.id)}
                      onCheckedChange={() => toggleSelection(file.id)}
                      className="border-white/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </div>
                )}
                {/* Video indicator */}
                {file.mimeType.startsWith("video/") && (
                  <div className="absolute bottom-2 right-2 z-10">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
                      <svg className="size-2.5" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                      Video
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Lightbox */}
      <PhotoLightbox
        files={allFiles}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}
