import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { getTodaysMealPlan, getMealieRecipeUrl, getMealieConfig } from "@/lib/mealie";
import { Tag, Store, ShoppingCart, BarChart3, ChefHat, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [productCount, storeCount, activeListCount, priceCount, recentPrices, activeLists, todaysMeals, mealieConfig] =
    await Promise.all([
      prisma.product.count({ where: { householdId, isActive: true } }),
      prisma.store.count({ where: { householdId, isActive: true } }),
      prisma.shoppingList.count({ where: { householdId, status: "ACTIVE" } }),
      prisma.storePrice.count({ where: { product: { householdId } } }),
      prisma.storePrice.findMany({
        where: { product: { householdId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          product: true,
          store: true,
        },
      }),
      prisma.shoppingList.findMany({
        where: { householdId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { items: true } } },
      }),
      getTodaysMealPlan(householdId).catch(() => []),
      getMealieConfig(householdId),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Grocery price tracker overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Products Tracked</CardTitle>
            <Tag className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productCount}</div>
            <p className="text-xs text-muted-foreground">Active products</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stores</CardTitle>
            <Store className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storeCount}</div>
            <p className="text-xs text-muted-foreground">Active stores</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Lists</CardTitle>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeListCount}</div>
            <p className="text-xs text-muted-foreground">Shopping lists in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Prices Logged</CardTitle>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{priceCount}</div>
            <p className="text-xs text-muted-foreground">Total price entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Meals from Mealie */}
      {todaysMeals.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ChefHat className="size-5" />
              Today&apos;s Meals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {todaysMeals
                .sort((a, b) => {
                  const order = ["breakfast", "lunch", "dinner", "side"];
                  return order.indexOf(a.entryType) - order.indexOf(b.entryType);
                })
                .map((meal) => (
                  <div key={meal.id} className="flex items-center gap-3 min-w-[200px]">
                    <Badge variant="secondary" className="shrink-0">
                      {meal.entryType}
                    </Badge>
                    <span className="text-sm font-medium">
                      {meal.recipe?.name || meal.title || meal.text}
                    </span>
                    {meal.recipe?.slug && mealieConfig && (
                      <a
                        href={getMealieRecipeUrl(mealieConfig.apiUrl, meal.recipe.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button variant="ghost" size="sm" className="h-6 px-1.5">
                          <ExternalLink className="size-3" />
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
            </div>
            <div className="mt-2">
              <Link href="/mealie" className="text-xs text-primary hover:underline">
                View full meal plan →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Prices</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPrices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No prices logged yet. Go to Products to start tracking.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPrices.map((price) => (
                    <TableRow key={price.id}>
                      <TableCell className="text-sm">
                        {formatDate(price.observedAt)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/products/${price.productId}`}
                          className="text-primary hover:underline"
                        >
                          {price.product.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="size-3 rounded-full border"
                            style={{
                              backgroundColor: price.store.color || "#94a3b8",
                            }}
                          />
                          <span className="text-sm">{price.store.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">
                          {formatCurrency(price.price)}
                        </span>
                        {price.onSale && (
                          <Badge
                            variant="destructive"
                            className="ml-1 text-[10px] px-1 py-0"
                          >
                            SALE
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Shopping Lists</CardTitle>
          </CardHeader>
          <CardContent>
            {activeLists.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active shopping lists.{" "}
                <Link href="/shopping-lists" className="text-primary hover:underline">
                  Create one
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {activeLists.map((list) => (
                  <Link
                    key={list.id}
                    href={`/shopping-lists/${list.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <div>
                      <div className="font-medium">{list.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {list._count.items} items
                      </div>
                    </div>
                    <Badge>Active</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
