import { useQuery } from "@tanstack/react-query";

export type ItemsParams = {
  q?: string;
  roomId?: string;
  page?: number;
  limit?: number;
  sort?: string;
  dir?: string;
};

export type ItemRoom = {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  floor: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ItemRecord = {
  id: string;
  householdId: string;
  roomId: string | null;
  name: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  purchasedFrom: string | null;
  warrantyExpires: string | null;
  warrantyNotes: string | null;
  condition: string;
  manualUrl: string | null;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  room: ItemRoom | null;
};

export type ItemsResponse = {
  items: ItemRecord[];
  rooms: ItemRoom[];
  totalCount: number;
  page: number;
  pageCount: number;
  warrantyAlerts: number;
};

async function fetchItems(params: ItemsParams): Promise<ItemsResponse> {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.roomId) sp.set("roomId", params.roomId);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.sort) sp.set("sort", params.sort);
  if (params.dir) sp.set("dir", params.dir);

  const res = await fetch(`/api/items/list?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch items");
  return res.json();
}

export function useItems(params: ItemsParams) {
  return useQuery({
    queryKey: ["items", params],
    queryFn: () => fetchItems(params),
  });
}
