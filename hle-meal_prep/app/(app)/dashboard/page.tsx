import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { getTodaysMealPlan, getMealieRecipeUrl, getMealieConfig } from "@/lib/mealie";
import {
  Tag,
  Store,
  ShoppingCart,
  BarChart3,
  ChefHat,
  ExternalLink,
  ArrowRight,
  Package,
  AlertTriangle,
  Clock,
  Plus,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UseItUp } from "@/components/use-it-up";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [
    productCount,
    storeCount,
    activeListCount,
    priceCount,
    recentPrices,
    activeLists,
    todaysMeals,
    mealieConfig,
    lowStockItems,
    outOfStockItems,
    expiringItems,
  ] = await Promise.all([
    prisma.product.count({ where: { householdId, isActive: true } }),
    prisma.store.count({ where: { householdId, isActive: true } }),
    prisma.shoppingList.count({ where: { householdId, status: "ACTIVE" } }),
    prisma.storePrice.count({ where: { product: { householdId } } }),
    prisma.storePrice.findMany({
      where: { product: { householdId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { product: true, store: true },
    }),
    prisma.shoppingList.findMany({
      where: { householdId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { items: true } },
        items: { select: { isChecked: true } },
      },
    }),
    getTodaysMealPlan(householdId).catch(() => []),
    getMealieConfig(householdId),
    prisma.pantryItem.findMany({
      where: {
        product: { householdId },
        minQuantity: { not: null },
      },
      include: { product: true },
    }).then(items => items.filter(i => i.minQuantity !== null && Number(i.quantity) <= Number(i.minQuantity) && Number(i.quantity) > 0)),
    prisma.pantryItem.count({
      where: { product: { householdId }, quantity: { lte: 0 } },
    }),
    prisma.pantryItem.findMany({
      where: {
        product: { householdId },
        expiresAt: { not: null, lte: new Date(Date.now() + 7 * 86400000) },
        quantity: { gt: 0 },
      },
      include: { product: true },
      orderBy: { expiresAt: "asc" },
      take: 5,
    }),
  ]);

  const mealTypeClass: Record<string, string> = {
    breakfast: "meal-breakfast",
    lunch: "meal-lunch",
    dinner: "meal-dinner",
    side: "meal-side",
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Today's Meals — hero card if Mealie connected */}
      {todaysMeals.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ChefHat className="size-4 text-primary" />
                Today&apos;s Meals
              </CardTitle>
              <Link
                href="/mealie"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Full plan
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {todaysMeals
                .sort((a, b) => {
                  const order = ["breakfast", "lunch", "dinner", "side"];
                  return order.indexOf(a.entryType) - order.indexOf(b.entryType);
                })
                .map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
                  >
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${mealTypeClass[meal.entryType] || "meal-side"}`}>
                      {meal.entryType}
                    </span>
                    <span className="text-sm font-medium">
                      {meal.recipe?.name || meal.title || meal.text}
                    </span>
                    {meal.recipe?.slug && mealieConfig && (
                      <a
                        href={getMealieRecipeUrl(mealieConfig.apiUrl, meal.recipe.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card-accent" style={{ "--stat-color": "var(--primary)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Products</span>
              <Tag className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{productCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">tracked items</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.14 260)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Stores</span>
              <Store className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{storeCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">price sources</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.16 145)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Active Lists</span>
              <ShoppingCart className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{activeListCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">in progress</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.65 0.16 80)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Prices</span>
              <BarChart3 className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{priceCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">entries logged</p>
          </CardContent>
        </Card>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          {/* Active shopping lists */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Shopping Lists</h2>
              </div>
              <Link
                href="/shopping-lists"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            {activeLists.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No active shopping lists.</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/shopping-lists">
                      <Plus className="size-3.5 mr-1.5" />
                      Create list
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {activeLists.map((list) => {
                  const checked = list.items.filter((i) => i.isChecked).length;
                  const total = list._count.items;
                  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
                  return (
                    <Link key={list.id} href={`/shopping-lists/${list.id}`}>
                      <div className="rounded-lg border p-3 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{list.name}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {checked}/{total} items
                          </span>
                        </div>
                        <div className="list-progress">
                          <div
                            className="list-progress-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent prices */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Recent Prices</h2>
              </div>
              <Link
                href="/price-compare"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Compare
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {recentPrices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No prices logged yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recentPrices.map((price) => (
                      <div
                        key={price.id}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/products/${price.productId}`}
                            className="text-sm font-medium hover:text-primary transition-colors truncate block"
                          >
                            {price.product.name}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: price.store.color || "#94a3b8" }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {price.store.name} &middot; {formatDate(price.observedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatCurrency(price.price)}
                          </span>
                          {price.onSale && (
                            <Badge variant="destructive" className="sale-badge text-[9px] px-1 py-0">
                              SALE
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right column — sidebar */}
        <div className="space-y-6">
          {/* Pantry alerts */}
          {(lowStockItems.length > 0 || outOfStockItems > 0 || expiringItems.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="size-4 pantry-low" />
                  Pantry Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {outOfStockItems > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="pantry-out font-medium">Out of stock</span>
                    <Badge variant="destructive" className="text-[9px]">{outOfStockItems}</Badge>
                  </div>
                )}
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="truncate">{item.product.name}</span>
                    <span className="pantry-low tabular-nums shrink-0 ml-2">
                      {Number(item.quantity)} / {Number(item.minQuantity)}
                    </span>
                  </div>
                ))}
                {expiringItems.length > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="pantry-out font-medium flex items-center gap-1">
                        <Clock className="size-3" />
                        Expiring soon
                      </span>
                    </div>
                    {expiringItems.map((item) => {
                      const exp = new Date(item.expiresAt!);
                      const diffDays = Math.ceil((exp.getTime() - Date.now()) / 86400000);
                      const label = diffDays < 0 ? `${Math.abs(diffDays)}d ago` : diffDays === 0 ? "today" : `${diffDays}d`;
                      return (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="truncate">{item.product.name}</span>
                          <span className={`shrink-0 ml-2 ${diffDays <= 0 ? "pantry-out font-medium" : "pantry-low"}`}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
                <Link
                  href="/pantry?filter=expiring"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  View pantry
                  <ArrowRight className="size-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Use It Up — AI recipe suggestions for expiring items */}
          {expiringItems.length > 0 && (
            <UseItUp
              expiringItems={expiringItems.map((item) => ({
                name: item.product.name,
                daysLeft: Math.ceil((new Date(item.expiresAt!).getTime() - Date.now()) / 86400000),
              }))}
              mealieApiUrl={mealieConfig?.apiUrl ?? null}
            />
          )}

          {/* Library overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Link href="/products" className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors">
                <div className="flex items-center gap-2.5 text-sm">
                  <Tag className="size-4 text-muted-foreground" />
                  <span>Products</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{productCount}</span>
              </Link>
              <Link href="/stores" className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors">
                <div className="flex items-center gap-2.5 text-sm">
                  <Store className="size-4 text-muted-foreground" />
                  <span>Stores</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{storeCount}</span>
              </Link>
              <Link href="/pantry" className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors">
                <div className="flex items-center gap-2.5 text-sm">
                  <Package className="size-4 text-muted-foreground" />
                  <span>Pantry</span>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link href="/shopping-lists" className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors">
                <ShoppingCart className="size-3.5" />
                New shopping list
              </Link>
              <Link href="/recipes" className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors">
                <BookOpen className="size-3.5" />
                Browse recipes
              </Link>
              <Link href="/products" className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors">
                <Tag className="size-3.5" />
                Add product
              </Link>
              <Link href="/price-compare" className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors">
                <BarChart3 className="size-3.5" />
                Compare prices
              </Link>
            </CardContent>
          </Card>

          {/* Mealie connection status */}
          {!mealieConfig && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ChefHat className="size-4" />
                  Mealie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Connect Mealie to import recipes and sync meal plans.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/settings">Connect</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
