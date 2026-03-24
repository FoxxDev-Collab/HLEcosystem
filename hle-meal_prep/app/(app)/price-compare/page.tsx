import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PriceComparePage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const params = await searchParams;
  const filterCategoryId = params.categoryId;

  const [stores, products, categories, allPrices] = await Promise.all([
    prisma.store.findMany({
      where: { householdId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: {
        householdId,
        isActive: true,
        ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
      },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.category.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
    prisma.storePrice.findMany({
      where: {
        product: {
          householdId,
          isActive: true,
          ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
        },
      },
      orderBy: { observedAt: "desc" },
    }),
  ]);

  // Build a map: productId -> storeId -> latest price info
  const priceMap = new Map<string, Map<string, { price: number; onSale: boolean }>>();
  for (const p of allPrices) {
    if (!priceMap.has(p.productId)) priceMap.set(p.productId, new Map());
    const storeMap = priceMap.get(p.productId)!;
    if (!storeMap.has(p.storeId)) {
      storeMap.set(p.storeId, { price: Number(p.price), onSale: p.onSale });
    }
  }

  // Find cheapest price per product
  const cheapestMap = new Map<string, number>();
  for (const [productId, storeMap] of priceMap) {
    let min = Infinity;
    for (const { price } of storeMap.values()) {
      if (price < min) min = price;
    }
    if (min < Infinity) cheapestMap.set(productId, min);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Price Compare</h1>
        <p className="text-muted-foreground">
          Compare product prices across stores to find the best deals
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/price-compare">
          <Badge variant={!filterCategoryId ? "default" : "outline"}>All</Badge>
        </Link>
        {categories.map((cat) => (
          <Link key={cat.id} href={`/price-compare?categoryId=${cat.id}`}>
            <Badge variant={filterCategoryId === cat.id ? "default" : "outline"}>
              {cat.name}
            </Badge>
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No products to compare</h3>
            <p className="text-sm text-muted-foreground">
              Add products and log prices to see comparisons.
            </p>
          </CardContent>
        </Card>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No stores configured</h3>
            <p className="text-sm text-muted-foreground">
              Add stores first, then log prices for your products.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Price Grid ({products.length} products x {stores.length} stores)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Product</TableHead>
                  {stores.map((store) => (
                    <TableHead key={store.id} className="text-center min-w-[100px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <div
                          className="size-3 rounded-full border shrink-0"
                          style={{ backgroundColor: store.color || "#94a3b8" }}
                        />
                        <span>{store.name}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const storeMap = priceMap.get(product.id);
                  const cheapest = cheapestMap.get(product.id);

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {product.name}
                        </Link>
                        {product.category && (
                          <div className="text-xs text-muted-foreground">
                            {product.category.name}
                          </div>
                        )}
                      </TableCell>
                      {stores.map((store) => {
                        const entry = storeMap?.get(store.id);
                        if (!entry) {
                          return (
                            <TableCell
                              key={store.id}
                              className="text-center text-muted-foreground"
                            >
                              {"\u2014"}
                            </TableCell>
                          );
                        }
                        const isCheapest = cheapest !== undefined && entry.price === cheapest;
                        return (
                          <TableCell
                            key={store.id}
                            className={`text-center ${
                              isCheapest
                                ? "bg-green-100 dark:bg-green-900/30 font-bold"
                                : ""
                            }`}
                          >
                            <div>
                              {formatCurrency(entry.price)}
                              {entry.onSale && (
                                <Badge
                                  variant="destructive"
                                  className="ml-1 text-[10px] px-1 py-0"
                                >
                                  SALE
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
