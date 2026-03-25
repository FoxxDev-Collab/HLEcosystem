"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, ShoppingCart, ChefHat, Lightbulb, X } from "lucide-react";
import {
  generateShoppingListAction,
  createShoppingListFromAiAction,
} from "@/app/(app)/shopping-lists/generate/actions";
import type { GeneratedItem, GenerateResult } from "@/app/(app)/shopping-lists/generate/actions";

export function SmartListGenerator({ mealieConnected }: { mealieConnected: boolean }) {
  const router = useRouter();
  const [generating, startGenerate] = useTransition();
  const [creating, startCreate] = useTransition();
  const [result, setResult] = useState<Extract<GenerateResult, { items: GeneratedItem[] }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [listName, setListName] = useState("");

  const handleGenerate = () => {
    setError(null);
    setResult(null);

    startGenerate(async () => {
      const res = await generateShoppingListAction();
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult(res);
        setItems(res.items);
        const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
        setListName(`Meal Plan — ${today}`);
      }
    });
  };

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleCreate = () => {
    const selected = items.filter((i) => i.selected);
    startCreate(async () => {
      const res = await createShoppingListFromAiAction(listName, selected);
      if (res.error) {
        setError(res.error);
      } else if (res.id) {
        router.push(`/shopping-lists/${res.id}`);
      }
    });
  };

  const selectedCount = items.filter((i) => i.selected).length;

  // Group items by category
  const groupedItems = items.reduce((acc, item, index) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...item, _index: index });
    return acc;
  }, {} as Record<string, (GeneratedItem & { _index: number })[]>);

  if (!mealieConnected) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ChefHat className="size-8 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Mealie Not Connected</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Connect Mealie in Settings to generate shopping lists from your meal plan.
          </p>
          <Button variant="outline" asChild>
            <a href="/settings">Go to Settings</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate button */}
      {!result && (
        <Card>
          <CardHeader>
            <CardTitle>Generate from Meal Plan</CardTitle>
            <CardDescription>
              Fetches this week&apos;s meal plan from Mealie, checks your pantry, and creates an
              optimized shopping list with only what you need to buy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGenerate} disabled={generating} size="lg">
              {generating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Analyzing recipes & pantry...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Generate Shopping List
                </>
              )}
            </Button>

            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Recipes used */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ChefHat className="size-4" />
                Recipes this week ({result.recipesUsed.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.recipesUsed.map((name) => (
                  <Badge key={name} variant="secondary">{name}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shopping items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Shopping List
                  <Badge variant="outline">{selectedCount} of {items.length} items</Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setItems((prev) => {
                      const allSelected = prev.every((i) => i.selected);
                      return prev.map((i) => ({ ...i, selected: !allSelected }));
                    })
                  }
                >
                  {items.every((i) => i.selected) ? "Deselect All" : "Select All"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(groupedItems)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([category, categoryItems]) => (
                    <div key={category}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {categoryItems.map((item) => (
                          <div
                            key={item._index}
                            className={`flex items-center gap-3 py-2 px-2 rounded-md hover:bg-accent/50 transition-colors ${
                              !item.selected ? "opacity-50" : ""
                            }`}
                          >
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleItem(item._index)}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{item.name}</span>
                              {item.notes && (
                                <span className="text-xs text-muted-foreground ml-2">({item.notes})</span>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground shrink-0 tabular-nums">
                              {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          {result.tips.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Lightbulb className="size-4 text-yellow-500" />
                  Shopping Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">&#x2022;</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Create list */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Label>List Name</Label>
                  <Input
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="Shopping list name"
                  />
                </div>
                <Button onClick={handleCreate} disabled={creating || selectedCount === 0}>
                  {creating ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="size-4 mr-2" />
                      Create List ({selectedCount} items)
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { setResult(null); setError(null); }}>
                  <X className="size-4 mr-2" />
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
