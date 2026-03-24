import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatUnit, formatDate } from "@/lib/format";
import {
  Package,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  PackageOpen,
  Search,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addToPantryAction,
  updatePantryQuantityAction,
  adjustPantryAction,
  setPantryMinAction,
  removeFromPantryAction,
  stockFromListAction,
} from "./actions";

const PRODUCT_UNITS = [
  "EACH", "LB", "OZ", "GALLON", "QUART", "LITER",
  "COUNT", "PACK", "BAG", "BOX", "CAN", "BOTTLE", "BUNCH", "DOZEN",
] as const;

type FilterTab = "all" | "in-stock" | "low-stock" | "out-of-stock";

function getStockStatus(quantity: number, minQuantity: number | null): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  key: FilterTab;
} {
  if (quantity <= 0) {
    return { label: "Out", variant: "destructive", key: "out-of-stock" };
  }
  if (minQuantity !== null && quantity <= minQuantity) {
    return { label: "Low", variant: "secondary", key: "low-stock" };
  }
  return { label: "In Stock", variant: "default", key: "in-stock" };
}

export default async function PantryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const params = await searchParams;
  const searchQuery = params.q?.trim() || "";
  const filterTab = (params.filter as FilterTab) || "all";

  const [pantryItems, availableProducts, activeLists] = await Promise.all([
    prisma.pantryItem.findMany({
      where: { householdId },
      include: {
        product: {
          include: { category: true },
        },
      },
      orderBy: { product: { name: "asc" } },
    }),
    prisma.product.findMany({
      where: {
        householdId,
        isActive: true,
        pantryItem: { is: null },
      },
      orderBy: { name: "asc" },
    }),
    prisma.shoppingList.findMany({
      where: {
        householdId,
        status: "ACTIVE",
        items: { some: { isChecked: true } },
      },
      include: {
        _count: { select: { items: { where: { isChecked: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Compute stats
  const totalItems = pantryItems.length;
  const lowStockCount = pantryItems.filter((item) => {
    const qty = Number(item.quantity);
    const min = item.minQuantity !== null ? Number(item.minQuantity) : null;
    return qty > 0 && min !== null && qty <= min;
  }).length;
  const outOfStockCount = pantryItems.filter(
    (item) => Number(item.quantity) <= 0
  ).length;

  // Apply search and filter
  const filtered = pantryItems.filter((item) => {
    const qty = Number(item.quantity);
    const min = item.minQuantity !== null ? Number(item.minQuantity) : null;
    const status = getStockStatus(qty, min);

    if (filterTab !== "all" && status.key !== filterTab) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = item.product.name.toLowerCase().includes(q);
      const matchesCategory = item.product.category?.name
        .toLowerCase()
        .includes(q);
      const matchesBrand = item.product.brand?.toLowerCase().includes(q);
      if (!matchesName && !matchesCategory && !matchesBrand) return false;
    }

    return true;
  });

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: totalItems },
    { key: "in-stock", label: "In Stock", count: totalItems - lowStockCount - outOfStockCount },
    { key: "low-stock", label: "Low Stock", count: lowStockCount },
    { key: "out-of-stock", label: "Out of Stock", count: outOfStockCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pantry</h1>
        <p className="text-muted-foreground">
          Track what you have on hand
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{lowStockCount}</span>
              {lowStockCount > 0 && (
                <AlertTriangle className="size-5 text-yellow-500" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Out of Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{outOfStockCount}</span>
              {outOfStockCount > 0 && (
                <PackageOpen className="size-5 text-destructive" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search pantry..."
            className="pl-9"
          />
          {filterTab !== "all" && (
            <input type="hidden" name="filter" value={filterTab} />
          )}
        </form>

        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/pantry?${new URLSearchParams({
                ...(searchQuery ? { q: searchQuery } : {}),
                ...(tab.key !== "all" ? { filter: tab.key } : {}),
              }).toString()}`}
            >
              <Badge variant={filterTab === tab.key ? "default" : "outline"}>
                {tab.label} ({tab.count})
              </Badge>
            </Link>
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
                <form key={list.id} action={stockFromListAction}>
                  <input type="hidden" name="listId" value={list.id} />
                  <Button type="submit" variant="outline" size="sm">
                    <Plus className="size-4 mr-1" />
                    {list.name} ({list._count.items} checked)
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
              action={addToPantryAction}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
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
                    <SelectValue placeholder="Product default" />
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
              <div className="flex items-end">
                <Button type="submit">
                  <Plus className="size-4 mr-1" />
                  Add
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pantry Items Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">
              {pantryItems.length === 0
                ? "Your pantry is empty"
                : "No items match your filter"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {pantryItems.length === 0
                ? "Add products to your pantry to start tracking stock."
                : "Try adjusting your search or filter."}
            </p>
            {pantryItems.length === 0 && availableProducts.length === 0 && (
              <Link href="/products" className="mt-3">
                <Button variant="outline" size="sm">
                  Add Products First
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Pantry Items ({filtered.length}
              {filtered.length !== pantryItems.length
                ? ` of ${pantryItems.length}`
                : ""}
              )
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-36">Quantity</TableHead>
                    <TableHead className="w-28">Min Qty</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-28">Updated</TableHead>
                    <TableHead className="w-24">Quick</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => {
                    const qty = Number(item.quantity);
                    const min =
                      item.minQuantity !== null
                        ? Number(item.minQuantity)
                        : null;
                    const status = getStockStatus(qty, min);
                    const unitLabel = item.unit
                      ? formatUnit(item.unit)
                      : formatUnit(item.product.defaultUnit);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">
                              {item.product.name}
                            </span>
                            {item.product.brand && (
                              <span className="text-muted-foreground">
                                {" "}
                                ({item.product.brand})
                              </span>
                            )}
                          </div>
                          {item.product.category && (
                            <Badge variant="secondary" className="mt-0.5 text-xs">
                              {item.product.category.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <form
                            action={updatePantryQuantityAction}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="id" value={item.id} />
                            <Input
                              name="quantity"
                              type="number"
                              step="0.001"
                              min="0"
                              defaultValue={qty}
                              className="h-8 w-20"
                            />
                            <span className="text-xs text-muted-foreground">
                              {unitLabel}
                            </span>
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                            >
                              Set
                            </Button>
                          </form>
                        </TableCell>
                        <TableCell>
                          <form
                            action={setPantryMinAction}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="id" value={item.id} />
                            <Input
                              name="minQuantity"
                              type="number"
                              step="0.001"
                              min="0"
                              defaultValue={min ?? ""}
                              placeholder="-"
                              className="h-8 w-16"
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                            >
                              Set
                            </Button>
                          </form>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(item.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <form action={adjustPantryAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={item.id}
                              />
                              <input
                                type="hidden"
                                name="amount"
                                value="-1"
                              />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <Minus className="size-3" />
                              </Button>
                            </form>
                            <form action={adjustPantryAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={item.id}
                              />
                              <input
                                type="hidden"
                                name="amount"
                                value="1"
                              />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <Plus className="size-3" />
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                        <TableCell>
                          <form action={removeFromPantryAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
