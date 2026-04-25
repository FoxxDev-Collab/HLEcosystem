import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function BudgetPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) notFound();

  const trips = await prisma.trip.findMany({
    where: { householdId, budgetItems: { some: {} } },
    orderBy: { startDate: "asc" },
    include: {
      budgetItems: { orderBy: { category: "asc" } },
    },
  });

  const grandPlanned = trips.reduce(
    (sum, t) => sum + t.budgetItems.reduce((s, b) => s + Number(b.plannedAmount), 0),
    0
  );
  const grandActual = trips.reduce(
    (sum, t) => sum + t.budgetItems.reduce((s, b) => s + (b.actualAmount ? Number(b.actualAmount) : 0), 0),
    0
  );
  const grandPct = grandPlanned > 0 ? Math.round((grandActual / grandPlanned) * 100) : 0;
  const overBudget = grandActual > grandPlanned;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget Overview</h1>
        <p className="text-muted-foreground">{trips.length} trip{trips.length !== 1 ? "s" : ""} with budget data</p>
      </div>

      {trips.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total across all trips</span>
              <div className="flex items-center gap-2">
                {overBudget
                  ? <TrendingUp className="size-4 text-destructive" />
                  : <TrendingDown className="size-4 text-green-600" />}
                <span className={`font-semibold ${overBudget ? "text-destructive" : "text-green-600"}`}>
                  {formatCurrency(grandActual)} spent
                </span>
                <span className="text-muted-foreground">of {formatCurrency(grandPlanned)} planned</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress
                value={Math.min(grandPct, 100)}
                className={`h-2 flex-1 ${overBudget ? "[&>div]:bg-destructive" : ""}`}
              />
              <span className={`text-sm font-medium shrink-0 ${overBudget ? "text-destructive" : "text-muted-foreground"}`}>
                {grandPct}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No budget data yet. Add budget items from a trip&apos;s detail page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {trips.map((trip) => {
            const planned = trip.budgetItems.reduce((s, b) => s + Number(b.plannedAmount), 0);
            const actual = trip.budgetItems.reduce((s, b) => s + (b.actualAmount ? Number(b.actualAmount) : 0), 0);
            const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
            const over = actual > planned;

            // Group by category
            const grouped = trip.budgetItems.reduce<Record<string, typeof trip.budgetItems>>((acc, b) => {
              if (!acc[b.category]) acc[b.category] = [];
              acc[b.category].push(b);
              return acc;
            }, {});

            return (
              <div key={trip.id} className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/trips/${trip.id}?tab=budget`} className="group flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold group-hover:text-primary transition-colors">{trip.name}</h2>
                    <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </Link>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    <span className={over ? "text-destructive font-medium" : ""}>{formatCurrency(actual)}</span>
                    <span>/</span>
                    <span>{formatCurrency(planned)}</span>
                    <Progress value={Math.min(pct, 100)} className={`h-1.5 w-20 ${over ? "[&>div]:bg-destructive" : ""}`} />
                    <span className={over ? "text-destructive" : ""}>{pct}%</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30">
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Planned</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Actual</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(grouped).map(([cat, items]) =>
                        items.map((b, i) => {
                          const diff = b.actualAmount ? Number(b.actualAmount) - Number(b.plannedAmount) : null;
                          return (
                            <tr key={b.id} className="border-b border-border/20 last:border-0">
                              <td className="px-4 py-2">{b.description}</td>
                              <td className="px-4 py-2">
                                {i === 0 && (
                                  <Badge variant="secondary" className="text-[10px]">{categoryLabel(cat)}</Badge>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(b.plannedAmount, b.currency)}</td>
                              <td className="px-4 py-2 text-right">{b.actualAmount ? formatCurrency(b.actualAmount, b.currency) : <span className="text-muted-foreground">—</span>}</td>
                              <td className={`px-4 py-2 text-right text-xs ${diff === null ? "" : diff > 0 ? "text-destructive" : "text-green-600"}`}>
                                {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatCurrency(Math.abs(diff), b.currency)}`}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border/60 bg-muted/20">
                        <td colSpan={2} className="px-4 py-2 text-xs font-semibold">Total</td>
                        <td className="px-4 py-2 text-right text-xs font-semibold">{formatCurrency(planned)}</td>
                        <td className="px-4 py-2 text-right text-xs font-semibold">{formatCurrency(actual)}</td>
                        <td className={`px-4 py-2 text-right text-xs font-semibold ${over ? "text-destructive" : "text-green-600"}`}>
                          {actual > 0 ? `${over ? "+" : ""}${formatCurrency(Math.abs(actual - planned))}` : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
