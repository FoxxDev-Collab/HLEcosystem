"use client";

import { useQuery } from "@tanstack/react-query";
import type { BreadcrumbItem } from "@/app/api/files/breadcrumbs/route";

export type { BreadcrumbItem };

async function fetchBreadcrumbs(
  folderId: string
): Promise<BreadcrumbItem[]> {
  const res = await fetch(
    `/api/files/breadcrumbs?folderId=${encodeURIComponent(folderId)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch breadcrumbs: ${res.status}`);
  }
  return res.json();
}

export function useBreadcrumbs(folderId: string | null | undefined) {
  return useQuery({
    queryKey: ["breadcrumbs", folderId],
    queryFn: () => fetchBreadcrumbs(folderId!),
    enabled: !!folderId,
    staleTime: 60_000,
  });
}
