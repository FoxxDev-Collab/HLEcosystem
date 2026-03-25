"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import { useItems, type ItemRecord, type ItemRoom } from "@/hooks/use-items";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Refrigerator, ShieldCheck, AlertTriangle, ChevronLeft, ChevronRight, Loader2, ArrowUpDown } from "lucide-react";
import { createItemAction } from "@/app/(app)/items/actions";

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "NEEDS_REPAIR", "DECOMMISSIONED"];

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: "bg-green-100 text-green-800",
  GOOD: "bg-blue-100 text-blue-800",
  FAIR: "bg-yellow-100 text-yellow-800",
  POOR: "bg-orange-100 text-orange-800",
  NEEDS_REPAIR: "bg-red-100 text-red-800",
  DECOMMISSIONED: "bg-gray-100 text-gray-800",
};

const ROW_HEIGHT = 48;

export function ItemsClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const { data, isLoading, isError } = useItems({
    q: debouncedSearch,
    roomId: roomFilter,
    page,
    limit: 50,
    sort,
    dir,
  });

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data?.items.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  const toggleSort = (column: string) => {
    if (sort === column) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(column);
      setDir("asc");
    }
    setPage(1);
  };

  const rooms: ItemRoom[] = data?.rooms ?? [];
  const now = new Date();

  async function handleCreateItem(formData: FormData) {
    await createItemAction(formData);
    queryClient.invalidateQueries({ queryKey: ["items"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Items & Appliances</h1>

      {/* Warranty alert */}
      {data && data.warrantyAlerts > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <AlertTriangle className="size-4" />
              <span>
                <strong>{data.warrantyAlerts}</strong> warranty
                {data.warrantyAlerts !== 1 ? "ies" : "y"} expiring within 30 days
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Item form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreateItem} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Dishwasher, HVAC Unit" required />
            </div>
            <div className="space-y-1">
              <Label>Room</Label>
              <Select name="roomId">
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Manufacturer</Label>
              <Input name="manufacturer" placeholder="Brand" />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input name="model" placeholder="Model number" />
            </div>
            <div className="space-y-1">
              <Label>Serial Number</Label>
              <Input name="serialNumber" placeholder="S/N" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input name="purchaseDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Price</Label>
              <Input name="purchasePrice" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Warranty Expires</Label>
              <Input name="warrantyExpires" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Condition</Label>
              <Select name="condition" defaultValue="GOOD">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Purchased From</Label>
              <Input name="purchasedFrom" placeholder="Store / retailer" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Optional" />
            </div>
            <Button type="submit">
              <Plus className="size-4 mr-2" />
              Add Item
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-64"
        />
        <Select
          value={roomFilter}
          onValueChange={(v) => {
            setRoomFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All rooms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rooms</SelectItem>
            {rooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground ml-auto">
            {data.totalCount} item{data.totalCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Items table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="size-6 mx-auto animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center text-red-500">
            Failed to load items. Please try again.
          </CardContent>
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Refrigerator className="size-10 mx-auto mb-3 opacity-40" />
            <p>No items yet. Add your home appliances, systems, and equipment.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Items ({data.totalCount})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Table header */}
            <div className="border rounded-md">
              <div
                className="grid items-center text-xs font-medium text-muted-foreground border-b bg-muted/50"
                style={{
                  gridTemplateColumns: "2fr 1fr 2fr 1fr 1fr 1fr",
                  height: ROW_HEIGHT,
                  padding: "0 16px",
                }}
              >
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground text-left">
                  Name <ArrowUpDown className="size-3" />
                </button>
                <button onClick={() => toggleSort("room")} className="flex items-center gap-1 hover:text-foreground text-left">
                  Room <ArrowUpDown className="size-3" />
                </button>
                <span>Manufacturer / Model</span>
                <button onClick={() => toggleSort("warranty")} className="flex items-center gap-1 hover:text-foreground text-left">
                  Warranty <ArrowUpDown className="size-3" />
                </button>
                <span className="text-right">Price</span>
                <button onClick={() => toggleSort("condition")} className="flex items-center gap-1 hover:text-foreground text-left">
                  Condition <ArrowUpDown className="size-3" />
                </button>
              </div>

              {/* Virtualized rows */}
              <div
                ref={parentRef}
                className="overflow-auto"
                style={{ maxHeight: Math.min(data.items.length * ROW_HEIGHT, 600) }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item: ItemRecord = data.items[virtualRow.index];
                    const warrantyDate = item.warrantyExpires ? new Date(item.warrantyExpires) : null;

                    return (
                      <div
                        key={item.id}
                        className="grid items-center text-sm border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                        style={{
                          gridTemplateColumns: "2fr 1fr 2fr 1fr 1fr 1fr",
                          height: ROW_HEIGHT,
                          padding: "0 16px",
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="truncate">
                          <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                            {item.name}
                          </Link>
                        </div>
                        <div className="text-muted-foreground truncate">{item.room?.name || "\u2014"}</div>
                        <div className="text-muted-foreground truncate">
                          {[item.manufacturer, item.model].filter(Boolean).join(" ") || "\u2014"}
                        </div>
                        <div>
                          {warrantyDate ? (
                            <div className="flex items-center gap-1 text-xs">
                              <ShieldCheck
                                className={`size-3 ${warrantyDate < now ? "text-red-500" : "text-green-600"}`}
                              />
                              <span className={warrantyDate < now ? "text-red-600" : "text-green-600"}>
                                {formatDate(warrantyDate)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          )}
                        </div>
                        <div className="text-right text-muted-foreground">
                          {item.purchasePrice ? formatCurrency(parseFloat(item.purchasePrice)) : "\u2014"}
                        </div>
                        <div>
                          <Badge className={CONDITION_COLORS[item.condition]}>
                            {item.condition.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pagination */}
            {data.pageCount > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {data.pageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="size-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
