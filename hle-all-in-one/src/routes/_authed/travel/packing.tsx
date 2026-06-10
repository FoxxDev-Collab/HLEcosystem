import { Link, createFileRoute } from "@tanstack/react-router"
import { CheckSquare, ChevronRight, Package } from "lucide-react"
import { getPackingRollupFn } from "@/server/travel/fns.overview"
import type { RollupPackingItemRow } from "@/server/travel/overview"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export const Route = createFileRoute("/_authed/travel/packing")({
  loader: () => getPackingRollupFn(),
  component: PackingPage,
})

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const CATEGORY_COLORS: Record<string, string> = {
  CLOTHING: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  TOILETRIES:
    "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
  ELECTRONICS:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  DOCUMENTS: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  MEDICATIONS:
    "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  OTHER: "bg-muted text-muted-foreground",
}

function PackingPage() {
  const trips = Route.useLoaderData()

  const totalItems = trips.reduce(
    (sum, t) => sum + t.lists.reduce((s, l) => s + l.items.length, 0),
    0
  )
  const totalPacked = trips.reduce(
    (sum, t) =>
      sum +
      t.lists.reduce((s, l) => s + l.items.filter((i) => i.isPacked).length, 0),
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Packing Lists</h1>
        <p className="text-sm text-muted-foreground">
          {totalPacked} of {totalItems} items packed across {trips.length} trip
          {trips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {totalItems > 0 && (
        <div className="flex items-center gap-3">
          <Progress
            value={Math.round((totalPacked / totalItems) * 100)}
            className="flex-1"
          />
          <span className="shrink-0 text-sm text-muted-foreground">
            {Math.round((totalPacked / totalItems) * 100)}% overall
          </span>
        </div>
      )}

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No packing lists yet. Create them from a trip&apos;s detail page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {trips.map((trip) => {
            const tripTotal = trip.lists.reduce((s, l) => s + l.items.length, 0)
            const tripPacked = trip.lists.reduce(
              (s, l) => s + l.items.filter((i) => i.isPacked).length,
              0
            )
            const pct =
              tripTotal > 0 ? Math.round((tripPacked / tripTotal) * 100) : 0

            return (
              <div key={trip.id} className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Link
                    to="/travel/trips/$id"
                    params={{ id: trip.id }}
                    search={{ tab: "packing" }}
                    className="group flex items-center gap-1.5"
                  >
                    <h2 className="text-sm font-semibold transition-colors group-hover:text-primary">
                      {trip.name}
                    </h2>
                    <ChevronRight className="size-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {tripPacked}/{tripTotal}
                    </span>
                    <Progress value={pct} className="w-24" />
                    <span className="w-8 text-xs text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </div>

                {trip.lists.map((list) => {
                  const listPacked = list.items.filter((i) => i.isPacked).length
                  const grouped = list.items.reduce<
                    Record<string, Array<RollupPackingItemRow>>
                  >((acc, item) => {
                    const bucket = acc[item.category] ?? []
                    bucket.push(item)
                    acc[item.category] = bucket
                    return acc
                  }, {})

                  return (
                    <div
                      key={list.id}
                      className="overflow-hidden rounded-lg border border-border/40 bg-card"
                    >
                      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-2.5">
                        <span className="text-sm font-medium">{list.name}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckSquare className="size-3" />
                          {listPacked}/{list.items.length}
                        </span>
                      </div>
                      <div className="space-y-3 p-3">
                        {Object.entries(grouped).map(([cat, items]) => (
                          <div key={cat} className="space-y-1.5">
                            <Badge
                              className={`border-0 ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.OTHER}`}
                            >
                              {categoryLabel(cat)}
                            </Badge>
                            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                                    item.isPacked
                                      ? "text-muted-foreground line-through"
                                      : ""
                                  }`}
                                >
                                  <div
                                    className={`flex size-3.5 shrink-0 items-center justify-center rounded-sm border ${
                                      item.isPacked
                                        ? "border-primary bg-primary"
                                        : "border-muted-foreground/40"
                                    }`}
                                  >
                                    {item.isPacked && (
                                      <CheckSquare className="size-2.5 text-primary-foreground" />
                                    )}
                                  </div>
                                  <span className="truncate">
                                    {item.quantity > 1
                                      ? `${item.quantity}× `
                                      : ""}
                                    {item.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {list.items.length === 0 && (
                          <p className="py-2 text-center text-xs text-muted-foreground">
                            No items yet
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
