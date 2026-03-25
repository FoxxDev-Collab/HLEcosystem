"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Package,
  Plus,
  AlertTriangle,
  PackageOpen,
  Search,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUnit } from "@/lib/format";
import { usePantry } from "@/hooks/use-pantry";
import { PantryTable } from "@/components/pantry-table";
import {
  addToPantryAction,
  stockFromListAction,
} from "@/app/(app)/pantry/actions";

const PRODUCT_UNITS = [
  "EACH", "LB", "OZ", "GALLON", "QUART", "LITER",
  "COUNT", "PACK", "BAG", "BOX", "CAN", "BOTTLE", "BUNCH", "DOZEN",
] as const;

type FilterTab = "all" | "in-stock" | "low-stock" | "out-of-stock" | "expiring";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in-stock", label: "In Stock" },
  { key: "low-stock", label: "Low Stock" },
  { key: "out-of-stock", label: "Out of Stock" },
  { key: "expiring", label: "Expiring" },
];

export function PantryClient({
  initialFilter,
  initialSearch,
}: {
  initialFilter: string;
  initialSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [filter, setFilter] = useState<FilterTab>(
    (initialFilter as FilterTab) || "all"
  );
  const [search, setSearch] = useState(initialSearch || "");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = usePantry({
    q: search || undefined,
    filter: filter !== "all" ? filter : undefined,
    page,
    limit: 50,
    sort: filter === "expiring" ? "expiration" : "name",
    dir: "asc",
  });

  function updateUrl(newFilter: FilterTab, newSearch: string) {
    const params = new URLSearchParams();
    if (newSearch) params.set("q", newSearch);
    if (newFilter !== "all") params.set("filter", newFilter);
    const qs = params.toString();
    router.replace(`/pantry${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function handleFilterChange(newFilter: FilterTab) {
    setFilter(newFilter);
    setPage(1);
    updateUrl(newFilter, search);
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string)?.trim() || "";
    setSearch(q);
    setPage(1);
    updateUrl(filter, q);
  }

  function handleAction(action: (formData: FormData) => Promise<void>, formData: FormData) {
    startTransition(async () => {
      await action(formData);
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
    });
  }

  const stats = data?.stats;
  const items = data?.items ?? [];
  const availableProducts = data?.availableProducts ?? [];
  const activeLists = data?.activeLists ?? [];
  const pageCount = data?.pageCount ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const filterTabsWithCounts: { key: FilterTab; label: string; count: number; alert?: boolean }[] = [
    { key: "all", label: "All", count: stats?.total ?? 0 },
    { key: "in-stock", label: "In Stock", count: stats?.inStock ?? 0 },
    { key: "low-stock", label: "Low Stock", count: stats?.lowStock ?? 0 },
    { key: "out-of-stock", label: "Out of Stock", count: stats?.outOfStock ?? 0 },
    { key: "expiring", label: "Expiring", count: stats?.expiring ?? 0, alert: (stats?.expiring ?? 0) > 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card-accent" style={{ "--stat-color": "var(--primary)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <span className="text-xs font-medium text-muted-foreground">Total Items</span>
            <div className="text-xl font-bold tabular-nums mt-1">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.65 0.16 80)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-muted-foreground">Low Stock</span>
              {(stats?.lowStock ?? 0) > 0 && <AlertTriangle className="size-3 pantry-low" />}
            </div>
            <div className="text-xl font-bold tabular-nums">{stats?.lowStock ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.2 25)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-muted-foreground">Out of Stock</span>
              {(stats?.outOfStock ?? 0) > 0 && <PackageOpen className="size-3 pantry-out" />}
            </div>
            <div className="text-xl font-bold tabular-nums">{stats?.outOfStock ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.18 30)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-muted-foreground">Expiring Soon</span>
              {(stats?.expiring ?? 0) > 0 && <Clock className="size-3 pantry-out" />}
            </div>
            <div className="text-xl font-bold tabular-nums">{stats?.expiring ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search pantry..."
            className="pl-9"
          />
        </form>

        <div className="flex flex-wrap gap-2">
          {filterTabsWithCounts.map((tab) => (
            <button key={tab.key} type="button" onClick={() => handleFilterChange(tab.key)}>
              <Badge
                variant={filter === tab.key ? "default" : "outline"}
                className={tab.alert && filter !== tab.key ? "border-destructive/50 text-destructive" : ""}
              >
                {tab.label} ({tab.count})
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Stock from Shopping List */}
      {activeLists.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock from Shopping List</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Add checked items from a completed shopping trip to your pantry.
            </p>
            <div className="flex flex-wrap gap-2">
              {activeLists.map((list) => (
                <form
                  key={list.id}
                  action={(formData) => handleAction(stockFromListAction, formData)}
                >
                  <input type="hidden" name="listId" value={list.id} />
                  <Button type="submit" variant="outline" size="sm" disabled={isPending}>
                    <Plus className="size-4 mr-1" />
                    {list.name} ({list.checkedCount} checked)
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add to Pantry */}
      {availableProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add to Pantry</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={(formData) => handleAction(addToPantryAction, formData)}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
            >
              <div className="space-y-2">
                <Label htmlFor="productId">Product *</Label>
                <Select name="productId" required>
                  <SelectTrigger id="productId">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.brand ? ` (${p.brand})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  defaultValue="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select name="unit">
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {formatUnit(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minQuantity">Min Threshold</Label>
                <Input
                  id="minQuantity"
                  name="minQuantity"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires</Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isPending}>
                  <Plus className="size-4 mr-1" />
                  Add
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">Failed to load pantry items. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Pantry Items Table */}
      {!isLoading && !error && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">
              {(stats?.total ?? 0) === 0
                ? "Your pantry is empty"
                : "No items match your filter"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {(stats?.total ?? 0) === 0
                ? "Add products to your pantry to start tracking stock."
                : "Try adjusting your search or filter."}
            </p>
            {(stats?.total ?? 0) === 0 && availableProducts.length === 0 && (
              <Link href="/products" className="mt-3">
                <Button variant="outline" size="sm">
                  Add Products First
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Pantry Items ({totalCount}
              {totalCount !== (stats?.total ?? 0)
                ? ` of ${stats?.total ?? 0}`
                : ""}
              )
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PantryTable items={items} />

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                >
                  Next
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
