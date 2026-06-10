import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ChevronRight,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { getBudgetRollupFn } from "@/server/travel/fns.overview"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/travel/budget")({
  loader: () => getBudgetRollupFn(),
  component: BudgetPage,
})

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// "OTHER" is not a valid ISO currency code for Intl — fall back to USD style.
function money(amount: number, currency = "USD"): string {
  return formatCurrency(amount, currency === "OTHER" ? "USD" : currency)
}

const destructiveBar = "[&_[data-slot=progress-indicator]]:bg-destructive"

function BudgetPage() {
  const { grand, trips } = Route.useLoaderData()

  const grandPct =
    grand.planned > 0 ? Math.round((grand.actual / grand.planned) * 100) : 0
  const overBudget = grand.actual > grand.planned

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Budget Overview</h1>
        <p className="text-sm text-muted-foreground">
          {trips.length} trip{trips.length !== 1 ? "s" : ""} with budget data
        </p>
      </div>

      {trips.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total across all trips
              </span>
              <div className="flex items-center gap-2">
                {overBudget ? (
                  <TrendingUp className="size-4 text-destructive" />
                ) : (
                  <TrendingDown className="size-4 text-green-600" />
                )}
                <span
                  className={`font-semibold ${overBudget ? "text-destructive" : "text-green-600"}`}
                >
                  {money(grand.actual)} spent
                </span>
                <span className="text-muted-foreground">
                  of {money(grand.planned)} planned
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress
                value={Math.min(grandPct, 100)}
                className={`flex-1 ${overBudget ? destructiveBar : ""}`}
              />
              <span
                className={`shrink-0 text-sm font-medium ${overBudget ? "text-destructive" : "text-muted-foreground"}`}
              >
                {grandPct}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No budget data yet. Add budget items from a trip&apos;s detail
              page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {trips.map((trip) => {
            const pct =
              trip.planned > 0
                ? Math.round((trip.actual / trip.planned) * 100)
                : 0
            const over = trip.actual > trip.planned

            // Items arrive ordered by category — group for the category badge.
            const grouped = trip.items.reduce<
              Record<string, typeof trip.items>
            >((acc, b) => {
              const bucket = acc[b.category] ?? []
              bucket.push(b)
              acc[b.category] = bucket
              return acc
            }, {})

            return (
              <div key={trip.id} className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Link
                    to="/travel/trips/$id"
                    params={{ id: trip.id }}
                    search={{ tab: "budget" }}
                    className="group flex items-center gap-1.5"
                  >
                    <h2 className="text-sm font-semibold transition-colors group-hover:text-primary">
                      {trip.name}
                    </h2>
                    <ChevronRight className="size-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={over ? "font-medium text-destructive" : ""}
                    >
                      {money(trip.actual)}
                    </span>
                    <span>/</span>
                    <span>{money(trip.planned)}</span>
                    <Progress
                      value={Math.min(pct, 100)}
                      className={`w-20 ${over ? destructiveBar : ""}`}
                    />
                    <span className={over ? "text-destructive" : ""}>
                      {pct}%
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Planned</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(grouped).map(([cat, items]) =>
                        items.map((b, i) => {
                          const diff =
                            b.actualAmount !== null
                              ? b.actualAmount - b.plannedAmount
                              : null
                          return (
                            <TableRow key={b.id}>
                              <TableCell>{b.description}</TableCell>
                              <TableCell>
                                {i === 0 && (
                                  <Badge variant="secondary">
                                    {categoryLabel(cat)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {money(b.plannedAmount, b.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {b.actualAmount !== null ? (
                                  money(b.actualAmount, b.currency)
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell
                                className={`text-right text-xs ${
                                  diff === null
                                    ? ""
                                    : diff > 0
                                      ? "text-destructive"
                                      : "text-green-600"
                                }`}
                              >
                                {diff === null
                                  ? "—"
                                  : `${diff > 0 ? "+" : ""}${money(Math.abs(diff), b.currency)}`}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/20">
                        <TableCell
                          colSpan={2}
                          className="text-xs font-semibold"
                        >
                          Total
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {money(trip.planned)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {money(trip.actual)}
                        </TableCell>
                        <TableCell
                          className={`text-right text-xs font-semibold ${
                            over ? "text-destructive" : "text-green-600"
                          }`}
                        >
                          {trip.actual > 0
                            ? `${over ? "+" : ""}${money(Math.abs(trip.actual - trip.planned))}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
