import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { formatUnit } from "@/lib/format";
import { ArrowLeft, Trash2, Package, Check, Copy } from "lucide-react";
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
  updateListStatusAction,
  addListItemAction,
  toggleListItemAction,
  removeListItemAction,
  duplicateListAction,
} from "../actions";
import { stockFromListAction } from "@/app/(app)/pantry/actions";

const PRODUCT_UNITS = [
  "EACH", "LB", "OZ", "GALLON", "QUART", "LITER",
  "COUNT", "PACK", "BAG", "BOX", "CAN", "BOTTLE", "BUNCH", "DOZEN",
] as const;

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

const statusColors: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  COMPLETED: "outline",
};

export default async function ShoppingListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { id } = await params;

  const [list, products, stores] = await Promise.all([
    prisma.shoppingList.findFirst({
      where: { id, householdId },
      include: {
        items: {
          include: {
            product: { include: { category: true } },
            store: true,
          },
          orderBy: [{ isChecked: "asc" }, { sortOrder: "asc" }],
        },
      },
    }),
    prisma.product.findMany({
      where: { householdId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.store.findMany({
      where: { householdId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!list) notFound();

  // Get best prices for each product on this list
  const productIds = list.items.map((item) => item.productId);
  const allPrices =
    productIds.length > 0
      ? await prisma.storePrice.findMany({
          where: { productId: { in: productIds } },
          orderBy: { observedAt: "desc" },
          include: { store: true },
        })
      : [];

  // Build best price map: productId -> { price, store }
  const bestPriceMap = new Map<
    string,
    { price: number; store: { id: string; name: string; color: string | null } }
  >();
  const latestPricePerProductStore = new Map<string, { price: number; storeId: string; storeName: string; storeColor: string | null }>();

  for (const p of allPrices) {
    const key = `${p.productId}-${p.storeId}`;
    if (!latestPricePerProductStore.has(key)) {
      latestPricePerProductStore.set(key, {
        price: Number(p.price),
        storeId: p.storeId,
        storeName: p.store.name,
        storeColor: p.store.color,
      });
    }
  }

  // Find cheapest store for each product
  for (const p of allPrices) {
    const current = bestPriceMap.get(p.productId);
    const latestKey = `${p.productId}-${p.storeId}`;
    const latest = latestPricePerProductStore.get(latestKey);
    if (!latest) continue;

    if (!current || latest.price < current.price) {
      bestPriceMap.set(p.productId, {
        price: latest.price,
        store: { id: p.storeId, name: latest.storeName, color: latest.storeColor },
      });
    }
  }

  // Fetch pantry data for products on this list
  const pantryItems = productIds.length > 0
    ? await prisma.pantryItem.findMany({
        where: { productId: { in: productIds }, householdId },
      })
    : [];

  // Build pantry lookup: productId -> quantity
  const pantryMap = new Map<string, number>();
  for (const p of pantryItems) {
    pantryMap.set(p.productId, Number(p.quantity));
  }

  // Shopping strategy: group items by cheapest store
  const storeGroups = new Map<string, { storeName: string; storeColor: string | null; items: typeof list.items; subtotal: number }>();
  const unpricedItems: typeof list.items = [];
  const pantryFullItems: typeof list.items = [];

  for (const item of list.items) {
    if (item.isChecked) continue;
    const needed = Number(item.quantity);
    const have = pantryMap.get(item.productId) ?? 0;
    const buy = Math.max(0, needed - have);
    if (buy === 0) {
      pantryFullItems.push(item);
      continue;
    }
    const best = bestPriceMap.get(item.productId);
    if (!best) {
      unpricedItems.push(item);
      continue;
    }
    const key = best.store.id;
    if (!storeGroups.has(key)) {
      storeGroups.set(key, {
        storeName: best.store.name,
        storeColor: best.store.color,
        items: [],
        subtotal: 0,
      });
    }
    const group = storeGroups.get(key)!;
    group.items.push(item);
    group.subtotal += best.price * buy;
  }

  const totalEstimated = Array.from(storeGroups.values()).reduce(
    (sum, g) => sum + g.subtotal,
    0
  );

  // Status transitions
  const nextStatus: Record<string, string | null> = {
    DRAFT: "ACTIVE",
    ACTIVE: "COMPLETED",
    COMPLETED: null,
  };
  const prevStatus: Record<string, string | null> = {
    DRAFT: null,
    ACTIVE: "DRAFT",
    COMPLETED: "ACTIVE",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/shopping-lists">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
            <Badge variant={statusColors[list.status]}>
              {statusLabels[list.status]}
            </Badge>
          </div>
          {list.notes && (
            <p className="text-sm text-muted-foreground mt-1">{list.notes}</p>
          )}
        </div>
        <div className="flex gap-2">
          {prevStatus[list.status] && (
            <form action={updateListStatusAction}>
              <input type="hidden" name="id" value={list.id} />
              <input type="hidden" name="status" value={prevStatus[list.status]!} />
              <Button type="submit" variant="outline" size="sm">
                Back to {statusLabels[prevStatus[list.status]!]}
              </Button>
            </form>
          )}
          {nextStatus[list.status] && (
            <form action={updateListStatusAction}>
              <input type="hidden" name="id" value={list.id} />
              <input type="hidden" name="status" value={nextStatus[list.status]!} />
              <Button type="submit" size="sm">
                Mark {statusLabels[nextStatus[list.status]!]}
              </Button>
            </form>
          )}
          <form action={duplicateListAction}>
            <input type="hidden" name="id" value={list.id} />
            <Button type="submit" variant="outline" size="sm" className="gap-1.5">
              <Copy className="size-4" />
              Duplicate
            </Button>
          </form>
          <form action={stockFromListAction}>
            <input type="hidden" name="listId" value={list.id} />
            <Button type="submit" variant="outline" size="sm" className="gap-1.5">
              <Package className="size-4" />
              Stock Pantry from Checked Items
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addListItemAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="listId" value={list.id} />
            <div className="space-y-2">
              <Label htmlFor="productId">Product *</Label>
              <Select name="productId" required>
                <SelectTrigger id="productId">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="0.001"
                min="0"
                defaultValue="1"
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
              <Label htmlFor="item-notes">Notes</Label>
              <Input id="item-notes" name="notes" placeholder="Optional" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit">Add Item</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {list.items.length > 0 && (storeGroups.size > 0 || unpricedItems.length > 0 || pantryFullItems.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Shopping Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pantryFullItems.length > 0 && (
              <div className="border rounded-lg p-4 border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400">
                  Covered by Pantry
                </h4>
                <ul className="space-y-1">
                  {pantryFullItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
                      <Check className="size-3.5" />
                      {item.product.name} x{Number(item.quantity)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.from(storeGroups.values()).map((group) => (
              <div key={group.storeName} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="size-4 rounded-full border"
                    style={{ backgroundColor: group.storeColor || "#94a3b8" }}
                  />
                  <h4 className="font-semibold">{group.storeName}</h4>
                  <span className="ml-auto text-sm font-medium">
                    Subtotal: {formatCurrency(group.subtotal)}
                  </span>
                </div>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const best = bestPriceMap.get(item.productId);
                    const needed = Number(item.quantity);
                    const have = pantryMap.get(item.productId) ?? 0;
                    const buy = Math.max(0, needed - have);
                    return (
                      <li key={item.id} className="flex justify-between text-sm">
                        <span>
                          {item.product.name} x{buy}
                          {have > 0 && (
                            <span className="text-muted-foreground ml-1">(need {needed}, have {have})</span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {best ? formatCurrency(best.price) : "\u2014"} each
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {unpricedItems.length > 0 && (
              <div className="border rounded-lg p-4 border-dashed">
                <h4 className="font-semibold mb-2 text-muted-foreground">
                  Unpriced Items
                </h4>
                <ul className="space-y-1">
                  {unpricedItems.map((item) => (
                    <li key={item.id} className="text-sm text-muted-foreground">
                      {item.product.name} x{Number(item.quantity)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {totalEstimated > 0 && (
              <div className="pt-2 border-t flex justify-between font-semibold">
                <span>Total Estimated Cost</span>
                <span>{formatCurrency(totalEstimated)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Items ({list.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {list.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No items yet. Use the form above to add products to this list.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Check</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Need</TableHead>
                  <TableHead>Have</TableHead>
                  <TableHead>Buy</TableHead>
                  <TableHead className="text-right">Best Price</TableHead>
                  <TableHead>Best Store</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((item) => {
                  const best = bestPriceMap.get(item.productId);
                  const needed = Number(item.quantity);
                  const have = pantryMap.get(item.productId) ?? 0;
                  const buy = Math.max(0, needed - have);
                  return (
                    <TableRow
                      key={item.id}
                      className={item.isChecked ? "opacity-50" : ""}
                    >
                      <TableCell>
                        <form action={toggleListItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="listId" value={list.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <div
                              className={`size-5 rounded border-2 flex items-center justify-center ${
                                item.isChecked
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground"
                              }`}
                            >
                              {item.isChecked && (
                                <svg
                                  className="size-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-medium ${
                            item.isChecked ? "line-through" : ""
                          }`}
                        >
                          {item.product.name}
                        </span>
                        {item.product.category && (
                          <div className="text-xs text-muted-foreground">
                            {item.product.category.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {needed}
                        {item.unit && (
                          <span className="text-muted-foreground ml-1">
                            {formatUnit(item.unit)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {have > 0 ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">{have}</span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {buy === 0 ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                            <Check className="size-3.5" />
                            In pantry
                          </span>
                        ) : buy < needed ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">{buy}</span>
                        ) : (
                          <span>{buy}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {best ? formatCurrency(best.price) : "\u2014"}
                      </TableCell>
                      <TableCell>
                        {best ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="size-3 rounded-full border"
                              style={{
                                backgroundColor:
                                  best.store.color || "#94a3b8",
                              }}
                            />
                            <span className="text-sm">{best.store.name}</span>
                          </div>
                        ) : (
                          "\u2014"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.notes || "\u2014"}
                      </TableCell>
                      <TableCell>
                        <form action={removeListItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="listId" value={list.id} />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
