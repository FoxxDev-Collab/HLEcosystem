import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import {
  ArrowLeft,
  Check,
  CheckCircle,
  ListPlus,
  Loader2,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
} from "lucide-react"
import { commitSyncFn, getSyncReviewFn } from "@/server/meals/fns.mealie"
import type { ReviewItem } from "@/server/meals/fns.mealie"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const searchSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  listName: z.string().max(200).optional(),
  recipeId: z.string().max(200).optional(),
  recipeName: z.string().max(300).optional(),
})

export const Route = createFileRoute("/_authed/meals/mealie/sync-review")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (!(deps.startDate && deps.endDate) && !deps.recipeId) {
      return { error: "Open this page from the meal plan or a recipe." }
    }
    return getSyncReviewFn({ data: deps })
  },
  component: SyncReviewPage,
})

const selectClass =
  "h-8 w-full max-w-[260px] rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

type EditableItem = ReviewItem & {
  included: boolean
  customName: string | null
  overrideProductId: string | null
}

type SyncMode = "new-list" | "existing-list" | "products-only"

function fmtQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function SyncReviewPage() {
  const data = Route.useLoaderData()

  if ("error" in data) {
    return (
      <div className="space-y-6">
        <Link
          to="/meals/mealie"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to meal plan
        </Link>
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  return <SyncReviewForm data={data} />
}

function SyncReviewForm({
  data,
}: {
  data: Exclude<Awaited<ReturnType<typeof getSyncReviewFn>>, { error: string }>
}) {
  const navigate = useNavigate()
  const {
    items,
    existingProducts,
    existingLists,
    defaultListName,
    sourceLabel,
    startDate,
    endDate,
  } = data

  const [editableItems, setEditableItems] = useState<Array<EditableItem>>(
    items.map((item) => ({
      ...item,
      included: true,
      customName: null,
      overrideProductId: null,
    }))
  )
  const [listName, setListName] = useState(defaultListName)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [syncMode, setSyncMode] = useState<SyncMode>("new-list")
  const [selectedListId, setSelectedListId] = useState<string>(
    existingLists[0]?.id ?? ""
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const includedCount = editableItems.filter((i) => i.included).length
  const newProductCount = editableItems.filter(
    (i) => i.included && !i.matchedProductId && !i.overrideProductId
  ).length
  const matchedCount = editableItems.filter(
    (i) => i.included && (i.matchedProductId || i.overrideProductId)
  ).length
  const pantryCoversCount = editableItems.filter(
    (i) => i.included && i.pantryQty >= i.quantity
  ).length

  function update(key: string, patch: Partial<EditableItem>) {
    setEditableItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    )
  }

  let submitLabel: string
  if (syncMode === "products-only") {
    submitLabel = `Import ${includedCount} Products`
    if (newProductCount < includedCount) {
      submitLabel += ` (${newProductCount} new)`
    }
  } else if (syncMode === "existing-list") {
    const listInfo = existingLists.find((l) => l.id === selectedListId)
    submitLabel = `Add ${includedCount} items to ${listInfo?.name || "list"}`
  } else {
    submitLabel = `Create List (${includedCount} items)`
    if (newProductCount > 0) submitLabel += ` + ${newProductCount} new products`
  }

  async function onCommit() {
    setError(null)
    setPending(true)
    try {
      const result = await commitSyncFn({
        data: {
          syncMode,
          listName: syncMode === "new-list" ? listName.trim() : undefined,
          existingListId:
            syncMode === "existing-list" ? selectedListId : undefined,
          startDate,
          endDate,
          items: editableItems
            .filter((i) => i.included)
            .map((i) => ({
              productName: i.customName || i.proposedName,
              normalizedKey: i.normalizedKey,
              quantity: i.quantity,
              recipeNote: i.recipeNote,
              existingProductId:
                i.overrideProductId || i.matchedProductId || null,
            })),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      if ("listId" in result && result.listId) {
        navigate({
          to: "/meals/shopping-lists/$id",
          params: { id: result.listId },
        })
        return
      }
      // products-only — back to the meal plan.
      navigate({ to: "/meals/mealie", search: {} })
      return
    } catch {
      setError("Sync failed.")
    }
    setPending(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/meals/mealie" search={{}}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Review Ingredients</h1>
          <p className="text-sm text-muted-foreground">{sourceLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="gap-1">
          <ShoppingCart className="size-3" />
          {includedCount} items selected
        </Badge>
        <Badge
          variant="outline"
          className="gap-1 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
        >
          <CheckCircle className="size-3" />
          {matchedCount} matched
        </Badge>
        <Badge
          variant="outline"
          className="gap-1 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
        >
          <Plus className="size-3" />
          {newProductCount} new
        </Badge>
        {pantryCoversCount > 0 && (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
          >
            <Package className="size-3" />
            {pantryCoversCount} in pantry
          </Badge>
        )}
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              setEditableItems((prev) =>
                prev.map((i) => ({ ...i, included: true }))
              )
            }
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              setEditableItems((prev) =>
                prev.map((i) => ({ ...i, included: false }))
              )
            }
          >
            Deselect all
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {editableItems.map((item) => {
              const isMatched = !!(
                item.matchedProductId || item.overrideProductId
              )
              const displayName = item.customName || item.proposedName
              const isEditing = editingKey === item.key
              return (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    !item.included ? "bg-muted/30 opacity-40" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      update(item.key, { included: !item.included })
                    }
                    className="mt-1 shrink-0"
                  >
                    <div
                      className={`flex size-5 items-center justify-center rounded border-2 transition-colors ${
                        item.included
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {item.included && (
                        <Check className="size-3" strokeWidth={3} />
                      )}
                    </div>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      {isEditing ? (
                        <Input
                          autoFocus
                          defaultValue={displayName}
                          className="h-7 max-w-[300px] text-sm"
                          onBlur={(e) => {
                            update(item.key, {
                              customName: e.target.value.trim() || null,
                            })
                            setEditingKey(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              update(item.key, {
                                customName:
                                  (e.target as HTMLInputElement).value.trim() ||
                                  null,
                              })
                              setEditingKey(null)
                            }
                            if (e.key === "Escape") setEditingKey(null)
                          }}
                        />
                      ) : (
                        <>
                          <span className="text-sm font-medium">
                            {displayName}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingKey(item.key)}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            title="Rename product"
                          >
                            <Pencil className="size-3" />
                          </button>
                        </>
                      )}
                      {isMatched ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-green-300 px-1.5 py-0 text-[10px] text-green-700 dark:border-green-700 dark:text-green-400"
                        >
                          Existing
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-blue-300 px-1.5 py-0 text-[10px] text-blue-700 dark:border-blue-700 dark:text-blue-400"
                        >
                          New
                        </Badge>
                      )}
                    </div>

                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {item.recipeNote}
                    </p>

                    {!item.matchedProductId && item.included && (
                      <div className="mt-1.5">
                        <select
                          className={selectClass}
                          value={item.overrideProductId || "_new"}
                          onChange={(e) =>
                            update(item.key, {
                              overrideProductId:
                                e.target.value === "_new"
                                  ? null
                                  : e.target.value,
                            })
                          }
                        >
                          <option value="_new">
                            + Create &quot;{displayName}&quot;
                          </option>
                          {existingProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="mt-0.5 min-w-[80px] shrink-0 text-right">
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
                            <span className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400">
                              <Check className="size-3" />
                              Covered
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              Buy: {fmtQty(item.quantity - item.pantryQty)}{" "}
                              {item.unit || ""}
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
                          <span className="ml-1 text-xs text-muted-foreground">
                            {item.unit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="sticky bottom-4 border-primary/20 bg-card/95 shadow-lg backdrop-blur-sm">
        <CardContent className="py-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={syncMode === "new-list" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
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
                className="h-8 text-xs"
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
              className="h-8 text-xs"
              onClick={() => setSyncMode("products-only")}
            >
              <Package className="size-3.5" />
              Import Products Only
            </Button>
          </div>

          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
            {syncMode === "new-list" && (
              <div className="w-full flex-1 space-y-1 sm:w-auto">
                <Label
                  htmlFor="commitListName"
                  className="text-xs text-muted-foreground"
                >
                  New list name
                </Label>
                <Input
                  id="commitListName"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {syncMode === "existing-list" && (
              <div className="w-full flex-1 space-y-1 sm:w-auto">
                <Label className="text-xs text-muted-foreground">
                  Add to list
                </Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                >
                  {existingLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.itemCount} items, {l.status.toLowerCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {syncMode === "products-only" && (
              <p className="flex-1 text-sm text-muted-foreground">
                Products will be imported to your catalog without creating a
                shopping list. You can add them to lists later.
              </p>
            )}

            <Button
              onClick={onCommit}
              disabled={
                pending ||
                includedCount === 0 ||
                (syncMode === "new-list" && !listName.trim()) ||
                (syncMode === "existing-list" && !selectedListId)
              }
              className="h-9"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Working…
                </>
              ) : (
                <>
                  <ShoppingCart className="size-4" />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
