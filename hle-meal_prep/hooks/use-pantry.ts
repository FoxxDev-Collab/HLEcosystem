"use client";

import { useQuery } from "@tanstack/react-query";

export type PantryParams = {
  q?: string;
  filter?: string;
  page?: number;
  limit?: number;
  sort?: string;
  dir?: string;
};

export type PantryItemData = {
  id: string;
  productId: string;
  quantity: number;
  unit: string | null;
  minQuantity: number | null;
  expiresAt: string | null;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    defaultUnit: string;
    category: { id: string; name: string } | null;
  };
};

export type PantryStats = {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  expiring: number;
};

export type AvailableProduct = {
  id: string;
  name: string;
  brand: string | null;
  defaultUnit: string;
};

export type ActiveList = {
  id: string;
  name: string;
  checkedCount: number;
};

export type PantryResponse = {
  items: PantryItemData[];
  totalCount: number;
  page: number;
  pageCount: number;
  stats: PantryStats;
  availableProducts: AvailableProduct[];
  activeLists: ActiveList[];
};

async function fetchPantry(params: PantryParams): Promise<PantryResponse> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.filter) searchParams.set("filter", params.filter);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.dir) searchParams.set("dir", params.dir);

  const res = await fetch(`/api/pantry/list?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch pantry");
  return res.json();
}

export function usePantry(params: PantryParams) {
  return useQuery({
    queryKey: ["pantry", params],
    queryFn: () => fetchPantry(params),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
