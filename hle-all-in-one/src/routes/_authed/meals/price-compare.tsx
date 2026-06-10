import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { BarChart3 } from "lucide-react"
import { getPriceComparePageFn } from "@/server/meals/fns.products"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/meals/price-compare")({
  loader: () => getPriceComparePageFn(),
  component: PriceComparePage,
})

function PriceComparePage() {
  const { stores, products, categories, latestPrices } = Route.useLoaderData()
  const [categoryId, setCategoryId] = useState<string | null>(null)

  // productId -> storeId -> latest price observation.
  const priceMap = new Map<
    string,
    Map<string, { price: number; onSale: boolean }>
  >()
  for (const p of latestPrices) {
    let storeMap = priceMap.get(p.productId)
    if (!storeMap) {
      storeMap = new Map()
      priceMap.set(p.productId, storeMap)
    }
    storeMap.set(p.storeId, { price: p.price, onSale: p.onSale })
  }

  // Cheapest latest price per product — highlighted green in the grid.
  const cheapestMap = new Map<string, number>()
  for (const [productId, storeMap] of priceMap) {
    let min = Infinity
    for (const { price } of storeMap.values()) {
      if (price < min) min = price
    }
    if (min < Infinity) cheapestMap.set(productId, min)
  }

  // Legacy ordering: category name (uncategorized last), then product name.
  const visible = (
    categoryId ? products.filter((p) => p.categoryId === categoryId) : products
  )
    .slice()
    .sort((a, b) => {
      if (a.categoryName !== b.categoryName) {
        if (a.categoryName === null) return 1
        if (b.categoryName === null) return -1
        return a.categoryName.localeCompare(b.categoryName)
      }
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Price compare</h1>
        <p className="text-sm text-muted-foreground">
          Compare product prices across stores to find the best deals.
        </p>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategoryId(null)}>
            <Badge variant={!categoryId ? "default" : "outline"}>All</Badge>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
            >
              <Badge variant={categoryId === cat.id ? "default" : "outline"}>
                {cat.name}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="mb-4 size-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No products to compare</h3>
            <p className="text-sm text-muted-foreground">
              Add products and log prices to see comparisons.
            </p>
          </CardContent>
        </Card>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="mb-4 size-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No stores configured</h3>
            <p className="text-sm text-muted-foreground">
              Add stores first, then log prices for your products.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Price grid ({visible.length} products × {stores.length} stores)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Product</TableHead>
                  {stores.map((store) => (
                    <TableHead
                      key={store.id}
                      className="min-w-[100px] text-center"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <div
                          className="size-3 shrink-0 rounded-full border"
                          style={{ backgroundColor: store.color || "#94a3b8" }}
                        />
                        <span>{store.name}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((product) => {
                  const storeMap = priceMap.get(product.id)
                  const cheapest = cheapestMap.get(product.id)

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Link
                          to="/meals/products/$id"
                          params={{ id: product.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {product.name}
                        </Link>
                        {product.categoryName && (
                          <div className="text-xs text-muted-foreground">
                            {product.categoryName}
                          </div>
                        )}
                      </TableCell>
                      {stores.map((store) => {
                        const entry = storeMap?.get(store.id)
                        if (!entry) {
                          return (
                            <TableCell
                              key={store.id}
                              className="text-center text-muted-foreground"
                            >
                              —
                            </TableCell>
                          )
                        }
                        const isCheapest =
                          cheapest !== undefined && entry.price === cheapest
                        return (
                          <TableCell
                            key={store.id}
                            className={
                              isCheapest
                                ? "bg-green-100 text-center font-bold dark:bg-green-900/30"
                                : "text-center"
                            }
                          >
                            {formatCurrency(entry.price)}
                            {entry.onSale && (
                              <Badge
                                variant="destructive"
                                className="ml-1 px-1 py-0 text-[10px]"
                              >
                                SALE
                              </Badge>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
