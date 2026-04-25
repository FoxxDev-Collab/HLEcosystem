"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useFiles } from "@/hooks/use-files";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateFolderDialog } from "@/components/create-folder-dialog";
import { ViewToggleWrapper } from "@/components/view-toggle-wrapper";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderPlus } from "lucide-react";
import type { FileListParams } from "@/hooks/use-files";

type BrowseClientProps = {
  userId: string;
  baseUrl: string;
  isPersonal?: boolean;
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
};

export function BrowseClient({
  userId,
  baseUrl,
  isPersonal = false,
  title = "Files",
  subtitle = "Browse and manage your household files",
  showSearch = true,
}: BrowseClientProps) {
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folderId") || null;
  const view = searchParams.get("view") || undefined;
  const q = searchParams.get("q")?.trim() || null;
  const tagFilter = searchParams.get("tag") || null;
  const sort = (searchParams.get("sort") || "date") as FileListParams["sort"];
  const dir = (searchParams.get("dir") || "desc") as "asc" | "desc";
  const type = searchParams.get("type") || null;

  // Build query params for the API
  const queryParams = useMemo<FileListParams>(
    () => ({
      folderId: q || tagFilter ? undefined : folderId,
      ownerId: isPersonal ? userId : null,
      sort,
      dir,
      type,
      tag: tagFilter,
      q,
      limit: 50,
    }),
    [folderId, userId, isPersonal, sort, dir, type, tagFilter, q]
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useFiles(queryParams);

  const { data: ancestors } = useBreadcrumbs(
    q || tagFilter ? null : folderId
  );

  // Flatten pages into single arrays
  const files = useMemo(
    () => data?.pages.flatMap((page) => page.files) ?? [],
    [data]
  );
  const folders = useMemo(
    () => data?.pages[0]?.folders ?? [],
    [data]
  );
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  // Fetch all tags for tag filter dropdown
  const allTags = useMemo(() => {
    const tagMap = new Map<string, { id: string; name: string; color: string | null }>();
    for (const file of files) {
      for (const tag of file.tags) {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag);
        }
      }
    }
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [files]);

  // Resolve page title
  const activeTagName = tagFilter
    ? allTags.find((t) => t.id === tagFilter)?.name
    : null;

  const displayTitle = q
    ? `Search: "${q}"`
    : activeTagName
      ? `Tag: ${activeTagName}`
      : title;

  const displaySubtitle = q || activeTagName
    ? `${totalCount} result${totalCount !== 1 ? "s" : ""} found`
    : subtitle;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{displayTitle}</h1>
          <p className="text-muted-foreground">{displaySubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {showSearch && <SearchInput baseUrl={baseUrl} className="w-full sm:w-64" />}
          <CreateFolderDialog
            parentFolderId={folderId}
            isPersonal={isPersonal}
            trigger={
              <Button variant="outline" size="sm">
                <FolderPlus className="size-4 mr-2" />
                New Folder
              </Button>
            }
          />
        </div>
      </div>

      {folderId && !q && !tagFilter && ancestors && ancestors.length > 0 && (
        <BreadcrumbNav ancestors={ancestors} baseUrl={baseUrl} />
      )}

      {isLoading ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <ViewToggleWrapper
          folders={folders}
          files={files}
          allTags={allTags}
          baseUrl={baseUrl}
          currentFolderId={folderId}
          initialView={view}
          activeTagFilter={tagFilter}
          showUploadDropzone={!q && !tagFilter}
          uploadFolderId={folderId}
          uploadIsPersonal={isPersonal}
          totalCount={totalCount}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
        />
      )}
    </div>
  );
}
