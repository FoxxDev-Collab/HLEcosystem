import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Package, CheckSquare, ChevronRight } from "lucide-react";

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const CATEGORY_COLORS: Record<string, string> = {
  CLOTHING:    "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  TOILETRIES:  "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
  ELECTRONICS: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  DOCUMENTS:   "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  MEDICATIONS: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  OTHER:       "bg-muted text-muted-foreground",
};

export default async function PackingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) notFound();

  const trips = await prisma.trip.findMany({
    where: { householdId, packingLists: { some: {} } },
    orderBy: { startDate: "asc" },
    include: {
      packingLists: {
        orderBy: { createdAt: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const totalItems = trips.reduce(
    (sum, t) => sum + t.packingLists.reduce((s, l) => s + l.items.length, 0),
    0
  );
  const totalPacked = trips.reduce(
    (sum, t) => sum + t.packingLists.reduce((s, l) => s + l.items.filter((i) => i.isPacked).length, 0),
    0
  );
  const overallPct = totalItems > 0 ? Math.round((totalPacked / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Packing Lists</h1>
        <p className="text-muted-foreground">
          {totalPacked} of {totalItems} items packed across {trips.length} trip{trips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {trips.length > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={overallPct} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground shrink-0">
            {overallPct}% overall
          </span>
        </div>
      )}

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No packing lists yet. Create them from a trip&apos;s detail page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {trips.map((trip) => {
            const tripTotal = trip.packingLists.reduce((s, l) => s + l.items.length, 0);
            const tripPacked = trip.packingLists.reduce((s, l) => s + l.items.filter((i) => i.isPacked).length, 0);
            const pct = tripTotal > 0 ? Math.round((tripPacked / tripTotal) * 100) : 0;

            return (
              <div key={trip.id} className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/trips/${trip.id}?tab=packing`} className="group flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold group-hover:text-primary transition-colors">{trip.name}</h2>
                    <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{tripPacked}/{tripTotal}</span>
                    <Progress value={pct} className="h-1.5 w-24" />
                    <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                  </div>
                </div>

                {trip.packingLists.map((list) => {
                  const listPacked = list.items.filter((i) => i.isPacked).length;
                  const grouped = list.items.reduce<Record<string, typeof list.items>>((acc, item) => {
                    if (!acc[item.category]) acc[item.category] = [];
                    acc[item.category].push(item);
                    return acc;
                  }, {});

                  return (
                    <div key={list.id} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/40">
                        <span className="text-sm font-medium">{list.name}</span>
                        <span className="text-xs text-muted-foreground">
                          <CheckSquare className="size-3 inline mr-1" />{listPacked}/{list.items.length}
                        </span>
                      </div>
                      <div className="p-3 space-y-3">
                        {Object.entries(grouped).map(([cat, items]) => (
                          <div key={cat} className="space-y-1.5">
                            <Badge className={`text-[10px] border-0 ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.OTHER}`}>
                              {categoryLabel(cat)}
                            </Badge>
                            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                              {items.map((item) => (
                                <div key={item.id} className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${item.isPacked ? "text-muted-foreground line-through" : ""}`}>
                                  <div className={`size-3.5 rounded-sm border shrink-0 flex items-center justify-center ${item.isPacked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                                    {item.isPacked && <CheckSquare className="size-2.5 text-primary-foreground" />}
                                  </div>
                                  <span className="truncate">{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {list.items.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">No items yet</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
