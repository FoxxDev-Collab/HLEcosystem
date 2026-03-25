import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getMealieShoppingList, getMealieConfig } from "@/lib/mealie";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, ShoppingCart, Check, Circle } from "lucide-react";
import { MergeForm } from "./merge-form";

export default async function MealieShoppingListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { id } = await params;
  const config = await getMealieConfig(householdId);
  if (!config) redirect("/settings");

  const list = await getMealieShoppingList(householdId, id);
  if (!list) notFound();

  // Fetch local shopping lists for merge target selection
  const localLists = await prisma.shoppingList.findMany({
    where: { householdId, status: { in: ["DRAFT", "ACTIVE"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true },
  });

  // Group items by label (aisle)
  const uncheckedItems = list.listItems.filter((i) => !i.checked);
  const checkedItems = list.listItems.filter((i) => i.checked);

  const groupedByLabel = new Map<string, typeof uncheckedItems>();
  for (const item of uncheckedItems) {
    const labelName = item.label?.name ?? "Other";
    if (!groupedByLabel.has(labelName)) {
      groupedByLabel.set(labelName, []);
    }
    groupedByLabel.get(labelName)!.push(item);
  }

  // Sort groups alphabetically, but "Other" last
  const sortedGroups = Array.from(groupedByLabel.entries()).sort((a, b) => {
    if (a[0] === "Other") return 1;
    if (b[0] === "Other") return -1;
    return a[0].localeCompare(b[0]);
  });

  // Serialize items for the client merge form
  const serializableItems = uncheckedItems.map((item) => ({
    id: item.id,
    display: item.display,
    foodName: item.food?.name ?? item.note ?? item.display,
    quantity: item.quantity,
    unitName: item.unit?.name ?? null,
    note: item.note,
    labelName: item.label?.name ?? null,
  }));

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Back link */}
      <Link
        href="/mealie/shopping-lists"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Mealie Shopping Lists
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
          <p className="text-muted-foreground text-sm">
            {uncheckedItems.length} item{uncheckedItems.length !== 1 ? "s" : ""} remaining
            {checkedItems.length > 0 && ` · ${checkedItems.length} checked off`}
          </p>
        </div>
        <a
          href={`${config.apiUrl}/g/home/shopping-lists/${id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent">
            <ExternalLink className="size-3" />
            Mealie
          </Badge>
        </a>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left — items list */}
        <div className="space-y-6 min-w-0">
          {/* Unchecked items by label/aisle */}
          {sortedGroups.map(([label, items]) => (
            <section key={label}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {label}
              </h3>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {items.sort((a, b) => a.position - b.position).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-2.5"
                      >
                        <Circle className="size-4 text-muted-foreground/30 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{item.display || item.food?.name || item.note}</p>
                          {item.note && item.food?.name && item.note !== item.food.name && (
                            <p className="text-[10px] text-muted-foreground truncate">{item.note}</p>
                          )}
                        </div>
                        {item.quantity > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {item.quantity}{item.unit?.name ? ` ${item.unit.name}` : ""}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          ))}

          {uncheckedItems.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">All items checked off!</p>
              </CardContent>
            </Card>
          )}

          {/* Checked items (collapsed) */}
          {checkedItems.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
                Checked ({checkedItems.length})
              </h3>
              <Card className="overflow-hidden opacity-50">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {checkedItems.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-2"
                      >
                        <Check className="size-4 text-primary shrink-0" />
                        <span className="text-sm line-through text-muted-foreground">
                          {item.display || item.food?.name || item.note}
                        </span>
                      </div>
                    ))}
                    {checkedItems.length > 10 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                        +{checkedItems.length - 10} more
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>

        {/* Right — merge panel */}
        <div className="space-y-4">
          <MergeForm
            mealieListId={id}
            mealieListName={list.name}
            items={serializableItems}
            localLists={localLists.map((l) => ({
              id: l.id,
              name: l.name,
              status: l.status,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
