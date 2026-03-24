"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Check,
  Plus,
  ShoppingCart,
  Pencil,
  CheckCircle,
  Loader2,
  Package,
  ListPlus,
} from "lucide-react";
import { commitSyncAction } from "./actions";
import type { ReviewItem, ExistingProduct, ExistingList } from "./page";

function fmtQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ── Submit button with pending state ────────────────────────────

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="gap-2 h-9">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Working...
        </>
      ) : (
        <>
          <ShoppingCart className="size-4" />
          {label}
        </>
      )}
    </Button>
  );
}

// ── Types ───────────────────────────────────────────────────────

type EditableItem = ReviewItem & {
  included: boolean;
  customName: string | null;
  overrideProductId: string | null;
};

type SyncMode = "new-list" | "existing-list" | "products-only";

// ── Main Form ───────────────────────────────────────────────────

export function SyncReviewForm({
  items,
  existingProducts,
  existingLists,
  defaultListName,
  sourceLabel,
  startDate,
  endDate,
  recipeId,
}: {
  items: ReviewItem[];
  existingProducts: ExistingProduct[];
  existingLists: ExistingList[];
  defaultListName: string;
  sourceLabel: string;
  startDate: string | null;
  endDate: string | null;
  recipeId: string | null;
}) {
  const [editableItems, setEditableItems] = useState<EditableItem[]>(
    items.map((item) => ({
      ...item,
      included: true,
      customName: null,
      overrideProductId: null,
    }))
  );
  const [listName, setListName] = useState(defaultListName);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [syncMode, setSyncMode] = useState<SyncMode>("new-list");
  const [selectedListId, setSelectedListId] = useState<string>(
    existingLists[0]?.id || ""
  );

  const includedCount = editableItems.filter((i) => i.included).length;
  const newProductCount = editableItems.filter(
    (i) => i.included && !i.matchedProductId && !i.overrideProductId
  ).length;
  const matchedCount = editableItems.filter(
    (i) => i.included && (i.matchedProductId || i.overrideProductId)
  ).length;
  const pantryCoversCount = editableItems.filter(
    (i) => i.included && i.pantryQty >= i.quantity
  ).length;

  function toggleItem(key: string) {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, included: !item.included } : item
      )
    );
  }

  function setCustomName(key: string, name: string) {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, customName: name || null } : item
      )
    );
  }

  function setOverrideProduct(key: string, productId: string | null) {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, overrideProductId: productId } : item
      )
    );
  }

  function selectAll() {
    setEditableItems((prev) => prev.map((item) => ({ ...item, included: true })));
  }

  function deselectAll() {
    setEditableItems((prev) => prev.map((item) => ({ ...item, included: false })));
  }

  // Build submit button label
  let submitLabel: string;
  if (syncMode === "products-only") {
    submitLabel = `Import ${includedCount} Products`;
    if (newProductCount < includedCount) {
      submitLabel += ` (${newProductCount} new)`;
    }
  } else if (syncMode === "existing-list") {
    const listInfo = existingLists.find((l) => l.id === selectedListId);
    submitLabel = `Add ${includedCount} items to ${listInfo?.name || "list"}`;
  } else {
    submitLabel = `Create List (${includedCount} items)`;
    if (newProductCount > 0) submitLabel += ` + ${newProductCount} new products`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/mealie">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Ingredients</h1>
          <p className="text-sm text-muted-foreground">{sourceLabel}</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="gap-1">
          <ShoppingCart className="size-3" />
          {includedCount} items selected
        </Badge>
        <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
          <CheckCircle className="size-3" />
          {matchedCount} matched
        </Badge>
        <Badge variant="outline" className="gap-1 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700">
          <Plus className="size-3" />
          {newProductCount} new
        </Badge>
        {pantryCoversCount > 0 && (
          <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
            <Package className="size-3" />
            {pantryCoversCount} in pantry
          </Badge>
        )}
        <div className="flex gap-1 ml-auto">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
            Select all
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>
            Deselect all
          </Button>
        </div>
      </div>

      {/* Items list */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {editableItems.map((item) => {
              const isMatched = !!(item.matchedProductId || item.overrideProductId);
              const displayName = item.customName || item.proposedName;
              const isEditing = editingKey === item.key;

              return (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    !item.included ? "opacity-40 bg-muted/30" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleItem(item.key)}
                    className="mt-1 shrink-0"
                  >
                    <div
                      className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                        item.included
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {item.included && (
                        <Check className="size-3" strokeWidth={3} />
                      )}
                    </div>
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <Input
                            autoFocus
                            defaultValue={displayName}
                            className="h-7 text-sm"
                            onBlur={(e) => {
                              setCustomName(item.key, e.target.value.trim());
                              setEditingKey(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setCustomName(item.key, (e.target as HTMLInputElement).value.trim());
                                setEditingKey(null);
                              }
                              if (e.key === "Escape") setEditingKey(null);
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium">{displayName}</span>
                          <button
                            type="button"
                            onClick={() => setEditingKey(item.key)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Rename product"
                          >
                            <Pencil className="size-3" />
                          </button>
                        </>
                      )}

                      {isMatched ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 shrink-0">
                          Existing
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 shrink-0">
                          New
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.recipeNote}
                    </p>

                    {!item.matchedProductId && item.included && (
                      <div className="mt-1.5">
                        <Select
                          value={item.overrideProductId || "_new"}
                          onValueChange={(val) =>
                            setOverrideProduct(item.key, val === "_new" ? null : val)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-[250px]">
                            <SelectValue placeholder="Create new product" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_new">
                              <span className="flex items-center gap-1.5">
                                <Plus className="size-3" />
                                Create &quot;{displayName}&quot;
                              </span>
                            </SelectItem>
                            {existingProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Quantity + Pantry info */}
                  <div className="text-right shrink-0 mt-0.5 min-w-[80px]">
                    {item.pantryQty > 0 ? (
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground">
                          Need: {fmtQty(item.quantity)} {item.unit || ""}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Have: {fmtQty(item.pantryQty)}
                        </div>
                        <div className="text-sm font-semibold">
                          {item.quantity <= item.pantryQty ? (
                            <span className="text-green-600 dark:text-green-400 flex items-center justify-end gap-1">
                              <Check className="size-3" />
                              Covered
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              Buy: {fmtQty(item.quantity - item.pantryQty)} {item.unit || ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-sm font-medium tabular-nums">
                          {fmtQty(item.quantity)}
                        </span>
                        {item.unit && (
                          <span className="text-xs text-muted-foreground ml-1">
                            {item.unit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action bar */}
      <Card className="sticky bottom-4 shadow-lg border-primary/20 bg-card/95 backdrop-blur-sm">
        <CardContent className="py-4">
          {/* Mode selector */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Button
              type="button"
              variant={syncMode === "new-list" ? "default" : "outline"}
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => setSyncMode("new-list")}
            >
              <Plus className="size-3.5" />
              New List
            </Button>
            {existingLists.length > 0 && (
              <Button
                type="button"
                variant={syncMode === "existing-list" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setSyncMode("existing-list")}
              >
                <ListPlus className="size-3.5" />
                Add to Existing List
              </Button>
            )}
            <Button
              type="button"
              variant={syncMode === "products-only" ? "default" : "outline"}
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => setSyncMode("products-only")}
            >
              <Package className="size-3.5" />
              Import Products Only
            </Button>
          </div>

          <form action={commitSyncAction}>
            <input type="hidden" name="startDate" value={startDate || ""} />
            <input type="hidden" name="endDate" value={endDate || ""} />
            <input type="hidden" name="recipeId" value={recipeId || ""} />
            <input type="hidden" name="syncMode" value={syncMode} />
            <input type="hidden" name="existingListId" value={syncMode === "existing-list" ? selectedListId : ""} />
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                editableItems
                  .filter((i) => i.included)
                  .map((i) => ({
                    productName: i.customName || i.proposedName,
                    normalizedKey: i.normalizedKey,
                    quantity: i.quantity,
                    recipeNote: i.recipeNote,
                    existingProductId: i.overrideProductId || i.matchedProductId || null,
                  }))
              )}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              {syncMode === "new-list" && (
                <div className="flex-1 space-y-1 w-full sm:w-auto">
                  <Label htmlFor="commitListName" className="text-xs text-muted-foreground">
                    New list name
                  </Label>
                  <Input
                    id="commitListName"
                    name="listName"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    required
                    className="h-9"
                  />
                </div>
              )}

              {syncMode === "existing-list" && (
                <div className="flex-1 space-y-1 w-full sm:w-auto">
                  <Label className="text-xs text-muted-foreground">
                    Add to list
                  </Label>
                  <Select
                    value={selectedListId}
                    onValueChange={setSelectedListId}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select a list" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLists.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          <span className="flex items-center gap-2">
                            {l.name}
                            <span className="text-xs text-muted-foreground">
                              ({l.itemCount} items, {l.status.toLowerCase()})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {syncMode === "products-only" && (
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Products will be imported to your catalog without creating a shopping list.
                    You can add them to lists later.
                  </p>
                </div>
              )}

              <SubmitButton
                label={submitLabel}
                disabled={
                  includedCount === 0 ||
                  (syncMode === "new-list" && !listName.trim()) ||
                  (syncMode === "existing-list" && !selectedListId)
                }
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
