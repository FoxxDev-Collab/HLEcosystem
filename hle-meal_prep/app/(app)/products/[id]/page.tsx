import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatUnit } from "@/lib/format";
import { getMealieConfig, getRecipes, getRecipeImageUrl } from "@/lib/mealie";
import { ArrowLeft, Trash2, Package, BookOpen } from "lucide-react";
import { PriceChart } from "@/components/price-chart";
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
import { updateProductAction, deleteProductAction } from "../actions";
import { logPriceAction, deletePriceAction } from "./actions";

const PRODUCT_UNITS = [
  "EACH", "LB", "OZ", "GALLON", "QUART", "LITER",
  "COUNT", "PACK", "BAG", "BOX", "CAN", "BOTTLE", "BUNCH", "DOZEN",
] as const;

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { id } = await params;

  const [product, categories, stores, pantryItem, mealieConfig] = await Promise.all([
    prisma.product.findFirst({
      where: { id, householdId },
      include: {
        category: true,
        prices: {
          orderBy: { observedAt: "desc" },
          include: { store: true },
        },
      },
    }),
    prisma.category.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
    prisma.store.findMany({
      where: { householdId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.pantryItem.findFirst({
      where: { productId: id, householdId },
    }),
    getMealieConfig(householdId),
  ]);

  if (!product) notFound();

  // Search Mealie for recipes using this product
  let usedInRecipes: { name: string; slug: string; id: string }[] = [];
  if (mealieConfig) {
    try {
      const search = await getRecipes(householdId, 1, 10, product.name);
      usedInRecipes = search.items.map((r) => ({ name: r.name, slug: r.slug, id: r.id }));
    } catch {
      // Mealie unavailable — skip
    }
  }

  // Build price chart data
  const chartStoreMap = new Map<string, { name: string; color: string }>();
  const chartDateMap = new Map<string, { date: string; [key: string]: string | number }>();

  for (const price of [...product.prices].reverse()) {
    const dateStr = formatDate(price.observedAt);
    const storeName = price.store.name;
    chartStoreMap.set(price.store.id, { name: storeName, color: price.store.color || "#94a3b8" });

    const existing = chartDateMap.get(dateStr) || { date: dateStr };
    existing[storeName] = Number(price.price);
    chartDateMap.set(dateStr, existing);
  }

  const chartData = Array.from(chartDateMap.values());
  const chartStores = Array.from(chartStoreMap.values());

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {product.category && (
              <Badge variant="secondary">{product.category.name}</Badge>
            )}
            {product.brand && (
              <span className="text-sm text-muted-foreground">{product.brand}</span>
            )}
            <span className="text-sm text-muted-foreground">
              {formatUnit(product.defaultUnit)}
            </span>
            {pantryItem && (
              <Badge variant="outline" className="gap-1">
                <Package className="size-3" />
                In Pantry: {Number(pantryItem.quantity)} {pantryItem.unit ? formatUnit(pantryItem.unit) : formatUnit(product.defaultUnit)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Edit Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateProductAction} className="space-y-4">
              <input type="hidden" name="id" value={product.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" name="name" defaultValue={product.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select name="categoryId" defaultValue={product.categoryId || ""}>
                  <SelectTrigger id="edit-category">
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-brand">Brand</Label>
                <Input id="edit-brand" name="brand" defaultValue={product.brand || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit">Unit</Label>
                <Select name="defaultUnit" defaultValue={product.defaultUnit}>
                  <SelectTrigger id="edit-unit">
                    <SelectValue />
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
                <Label htmlFor="edit-notes">Notes</Label>
                <Input id="edit-notes" name="notes" defaultValue={product.notes || ""} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save Changes</Button>
                <form action={deleteProductAction}>
                  <input type="hidden" name="id" value={product.id} />
                  <Button type="submit" variant="destructive">
                    Delete Product
                  </Button>
                </form>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log Price</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={logPriceAction} className="space-y-4">
              <input type="hidden" name="productId" value={product.id} />
              <div className="space-y-2">
                <Label htmlFor="log-store">Store *</Label>
                <Select name="storeId" required>
                  <SelectTrigger id="log-store">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-price">Price *</Label>
                <Input
                  id="log-price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-date">Date</Label>
                <Input
                  id="log-date"
                  name="observedAt"
                  type="date"
                  defaultValue={today}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="log-sale"
                  name="onSale"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="log-sale">On Sale</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-notes">Notes</Label>
                <Input id="log-notes" name="notes" placeholder="Optional" />
              </div>
              <Button type="submit" className="w-full">Log Price</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Price Trend Chart */}
      {chartData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Price Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChart data={chartData} stores={chartStores} />
          </CardContent>
        </Card>
      )}

      {/* Used in Recipes */}
      {usedInRecipes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-5" />
              Used in Recipes ({usedInRecipes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {usedInRecipes.map((recipe) => (
                <Link
                  key={recipe.slug}
                  href={`/recipes/${recipe.slug}`}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  {mealieConfig && (
                    <img
                      src={getRecipeImageUrl(mealieConfig.apiUrl, recipe.id)}
                      alt=""
                      className="size-10 rounded object-cover"
                    />
                  )}
                  <span className="text-sm font-medium line-clamp-1">{recipe.name}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Price History ({product.prices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {product.prices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No prices logged yet. Use the form above to log your first price.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Sale</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.prices.map((price) => (
                  <TableRow key={price.id}>
                    <TableCell>{formatDate(price.observedAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full border"
                          style={{ backgroundColor: price.store.color || "#94a3b8" }}
                        />
                        {price.store.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(price.price)}
                    </TableCell>
                    <TableCell>
                      {price.onSale && (
                        <Badge variant="destructive" className="text-xs">
                          SALE
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {price.notes || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <form action={deletePriceAction}>
                        <input type="hidden" name="id" value={price.id} />
                        <input type="hidden" name="productId" value={product.id} />
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
