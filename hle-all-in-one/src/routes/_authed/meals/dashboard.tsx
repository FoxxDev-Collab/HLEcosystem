import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  ChefHat,
  Clock,
  ExternalLink,
  Loader2,
  Package,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
} from "lucide-react"
import {
  getMealsDashboardFn,
  suggestRecipesForExpiringFn,
} from "@/server/meals/fns.dashboard"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/meals/dashboard")({
  loader: () => getMealsDashboardFn(),
  component: MealsDashboardPage,
})

const MS_PER_DAY = 86400000
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "side"]

function daysLeft(expiresAt: string): number {
  const [y, m, d] = expiresAt.split("-").map(Number)
  return Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / MS_PER_DAY)
}

function MealsDashboardPage() {
  const data = Route.useLoaderData()
  const {
    counts,
    recentPrices,
    activeLists,
    lowStock,
    outOfStockCount,
    expiring,
    mealieConnected,
    mealieApiUrl,
    todaysMeals,
    userName,
  } = data

  const expiringWithDays = expiring.map((item) => ({
    ...item,
    daysLeft: item.expiresAt !== null ? daysLeft(item.expiresAt) : 0,
  }))

  const sortedMeals = [...todaysMeals].sort(
    (a, b) => MEAL_ORDER.indexOf(a.entryType) - MEAL_ORDER.indexOf(b.entryType)
  )

  const stats = [
    {
      label: "Products",
      value: counts.productCount,
      hint: "tracked items",
      icon: Tag,
    },
    {
      label: "Stores",
      value: counts.storeCount,
      hint: "price sources",
      icon: Store,
    },
    {
      label: "Active Lists",
      value: counts.activeListCount,
      hint: "in progress",
      icon: ShoppingCart,
    },
    {
      label: "Prices",
      value: counts.priceCount,
      hint: "entries logged",
      icon: BarChart3,
    },
  ]

  return (
    <div className="max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          Welcome back, {userName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {sortedMeals.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ChefHat className="size-4 text-primary" />
                Today&apos;s Meals
              </CardTitle>
              <Link
                to="/meals/mealie"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Full plan
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {sortedMeals.map((meal) => (
                <div
                  key={meal.id}
                  className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
                >
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {meal.entryType}
                  </Badge>
                  <span className="text-sm font-medium">
                    {meal.recipe?.name || meal.title || meal.text}
                  </span>
                  {meal.recipe?.slug && mealieApiUrl && (
                    <a
                      href={`${mealieApiUrl}/g/home/r/${meal.recipe.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground transition-colors hover:text-foreground"
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="px-4 pt-4 pb-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {s.label}
                </span>
                <s.icon className="size-3.5 text-muted-foreground/50" />
              </div>
              <div className="text-xl font-bold tabular-nums">{s.value}</div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {s.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          {/* Active shopping lists */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Shopping Lists</h2>
              </div>
              <Link
                to="/meals/shopping-lists"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            {activeLists.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="mb-3 text-sm text-muted-foreground">
                    No active shopping lists.
                  </p>
                  <Link to="/meals/shopping-lists">
                    <Button variant="outline" size="sm">
                      Create list
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {activeLists.map((list) => {
                  const pct =
                    list.itemCount > 0
                      ? Math.round((list.checkedCount / list.itemCount) * 100)
                      : 0
                  return (
                    <Link
                      key={list.id}
                      to="/meals/shopping-lists/$id"
                      params={{ id: list.id }}
                    >
                      <div className="rounded-lg border p-3 transition-colors hover:bg-accent/30">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {list.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {list.checkedCount}/{list.itemCount} items
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* Recent prices */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Recent Prices</h2>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {recentPrices.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No prices logged yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recentPrices.map((price) => (
                      <div
                        key={price.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {price.productName}
                          </span>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <div
                              className="size-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: price.storeColor || "#94a3b8",
                              }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {price.storeName} · {formatDate(price.observedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-1.5">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatCurrency(price.price)}
                          </span>
                          {price.onSale && (
                            <Badge
                              variant="destructive"
                              className="px-1 py-0 text-[9px]"
                            >
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

        {/* Sidebar */}
        <div className="space-y-6">
          {(lowStock.length > 0 ||
            outOfStockCount > 0 ||
            expiringWithDays.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="size-4 text-amber-500" />
                  Pantry Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {outOfStockCount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-destructive">
                      Out of stock
                    </span>
                    <Badge variant="destructive" className="text-[9px]">
                      {outOfStockCount}
                    </Badge>
                  </div>
                )}
                {lowStock.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="truncate">{item.productName}</span>
                    <span className="ml-2 shrink-0 text-amber-600 tabular-nums dark:text-amber-400">
                      {item.quantity} / {item.minQuantity}
                    </span>
                  </div>
                ))}
                {expiringWithDays.length > 0 && (
                  <>
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="flex items-center gap-1 font-medium text-destructive">
                        <Clock className="size-3" />
                        Expiring soon
                      </span>
                    </div>
                    {expiringWithDays.map((item) => {
                      const label =
                        item.daysLeft < 0
                          ? `${Math.abs(item.daysLeft)}d ago`
                          : item.daysLeft === 0
                            ? "today"
                            : `${item.daysLeft}d`
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="truncate">{item.productName}</span>
                          <span
                            className={`ml-2 shrink-0 ${
                              item.daysLeft <= 0
                                ? "font-medium text-destructive"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {expiringWithDays.length > 0 && (
            <UseItUpCard
              expiringItems={expiringWithDays.map((item) => ({
                name: item.productName,
                daysLeft: item.daysLeft,
              }))}
              mealieApiUrl={mealieApiUrl}
            />
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link
                to="/meals/shopping-lists"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <ShoppingCart className="size-3.5" />
                New shopping list
              </Link>
              <Link
                to="/meals/recipes"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <BookOpen className="size-3.5" />
                Browse recipes
              </Link>
              <Link
                to="/meals/receipts"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <Tag className="size-3.5" />
                Scan a receipt
              </Link>
              <Link
                to="/meals/shopping-lists/generate"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <Sparkles className="size-3.5" />
                Smart list from meal plan
              </Link>
              <Link
                to="/meals/recipes/what-can-i-cook"
                className="flex items-center gap-2.5 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <Package className="size-3.5" />
                What can I cook?
              </Link>
            </CardContent>
          </Card>

          {!mealieConnected && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ChefHat className="size-4" />
                  Mealie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-muted-foreground">
                  Connect Mealie to import recipes and sync meal plans.
                </p>
                <Link to="/meals/settings">
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// "Use It Up" — AI recipe suggestions for expiring pantry items. Degrades to
// the server's "AI features not configured" error when the gateway is unset.
function UseItUpCard({
  expiringItems,
  mealieApiUrl,
}: {
  expiringItems: Array<{ name: string; daysLeft: number }>
  mealieApiUrl: string | null
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Array<{
    recipeName: string
    reasoning: string
    missingIngredients: Array<string>
    difficulty: string
    estimatedTime: string
    mealieSlug: string | null
  }> | null>(null)

  async function onSuggest() {
    setPending(true)
    setError(null)
    try {
      const result = await suggestRecipesForExpiringFn({
        data: { ingredients: expiringItems.map((i) => i.name) },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else if ("suggestions" in result) {
        setSuggestions(result.suggestions)
      }
    } catch {
      setError("Could not get suggestions.")
    }
    setPending(false)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          Use It Up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {expiringItems.length} item{expiringItems.length !== 1 ? "s" : ""}{" "}
          expiring soon:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {expiringItems.map((item) => (
            <Badge
              key={item.name}
              variant={item.daysLeft <= 1 ? "destructive" : "secondary"}
              className="text-[10px]"
            >
              {item.name}
              <span className="ml-1 opacity-70">
                {item.daysLeft <= 0 ? "expired" : `${item.daysLeft}d`}
              </span>
            </Badge>
          ))}
        </div>

        {!suggestions && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onSuggest}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Finding recipes…
              </>
            ) : (
              <>
                <ChefHat className="size-3.5" />
                Suggest Recipes
              </>
            )}
          </Button>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {suggestions && suggestions.length > 0 && (
          <div className="space-y-2 pt-1">
            {suggestions.slice(0, 4).map((s, i) => (
              <div key={i} className="space-y-1 rounded-md border p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.recipeName}</span>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    {s.estimatedTime}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {s.reasoning}
                </p>
                {s.missingIngredients.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      Need:
                    </span>
                    {s.missingIngredients.slice(0, 3).map((ing) => (
                      <Badge
                        key={ing}
                        variant="outline"
                        className="py-0 text-[9px]"
                      >
                        {ing}
                      </Badge>
                    ))}
                    {s.missingIngredients.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{s.missingIngredients.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                {s.mealieSlug && mealieApiUrl && (
                  <a
                    href={`${mealieApiUrl}/g/home/r/${s.mealieSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 pt-0.5 text-[10px] text-primary hover:underline"
                  >
                    View in Mealie <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
