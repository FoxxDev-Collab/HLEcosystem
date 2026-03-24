"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  FileListResponse,
  FileListParams,
} from "@/app/api/files/list/route";

export type { FileListResponse, FileListParams };
export type { SerializedFile, SerializedFolder } from "@/app/api/files/list/route";

async function fetchFiles(
  params: FileListParams & { cursor?: string | null }
): Promise<FileListResponse> {
  const searchParams = new URLSearchParams();

  if (params.folderId) searchParams.set("folderId", params.folderId);
  if (params.ownerId) searchParams.set("ownerId", params.ownerId);
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.dir) searchParams.set("dir", params.dir);
  if (params.type) searchParams.set("type", params.type);
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);
  if (params.mode) searchParams.set("mode", params.mode);

  const res = await fetch(`/api/files/list?${searchParams.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch files: ${res.status}`);
  }
  return res.json();
}

export function useFiles(params: FileListParams) {
  return useInfiniteQuery({
    queryKey: ["files", params],
    queryFn: ({ pageParam }) =>
      fetchFiles({ ...params, cursor: pageParam ?? null }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
