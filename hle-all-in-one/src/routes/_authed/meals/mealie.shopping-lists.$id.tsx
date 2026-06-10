import { useState } from "react"
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from "@tanstack/react-router"
import {
  ArrowLeft,
  Check,
  Circle,
  ExternalLink,
  Loader2,
  Merge,
  Plus,
  ShoppingCart,
} from "lucide-react"
import {
  getMealieShoppingListFn,
  mergeMealieListFn,
} from "@/server/meals/fns.mealie"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute(
  "/_authed/meals/mealie/shopping-lists/$id"
)({
  loader: async ({ params }) => {
    const data = await getMealieShoppingListFn({ data: { id: params.id } })
    if (!data.configured) return data
    if (!data.list && !data.error) throw notFound()
    return data
  },
  component: MealieShoppingListDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

type MergeItem = {
  id: string
  display: string
  foodName: string
  quantity: number
  unitName: string | null
  note: string
  labelName: string | null
}

function MealieShoppingListDetailPage() {
  const data = Route.useLoaderData()
  const { id } = Route.useParams()

  if (!data.configured) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Mealie is not connected.{" "}
          <Link to="/meals/settings" className="text-primary hover:underline">
            Go to Settings
          </Link>
        </p>
      </div>
    )
  }

  const { apiUrl, list, error, localLists } = data

  if (!list) {
    return (
      <div className="space-y-6">
        <BackLink />
        <p className="text-sm text-destructive">
          {error ?? "Could not load this list from Mealie."}
        </p>
      </div>
    )
  }

  const uncheckedItems = list.listItems.filter((i) => !i.checked)
  const checkedItems = list.listItems.filter((i) => i.checked)

  // Group unchecked items by Mealie label (aisle); "Other" sorts last.
  const groupedByLabel = new Map<string, typeof uncheckedItems>()
  for (const item of uncheckedItems) {
    const labelName = item.label?.name ?? "Other"
    const group = groupedByLabel.get(labelName) ?? []
    group.push(item)
    groupedByLabel.set(labelName, group)
  }
  const sortedGroups = [...groupedByLabel.entries()].sort((a, b) => {
    if (a[0] === "Other") return 1
    if (b[0] === "Other") return -1
    return a[0].localeCompare(b[0])
  })

  const mergeItems: Array<MergeItem> = uncheckedItems.map((item) => ({
    id: item.id,
    display: item.display,
    foodName: item.food?.name ?? item.note ?? item.display,
    quantity: item.quantity,
    unitName: item.unit?.name ?? null,
    note: item.note,
    labelName: item.label?.name ?? null,
  }))

  return (
    <div className="max-w-[1200px] space-y-6">
      <BackLink />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{list.name}</h1>
          <p className="text-sm text-muted-foreground">
            {uncheckedItems.length} item
            {uncheckedItems.length !== 1 ? "s" : ""} remaining
            {checkedItems.length > 0 && ` · ${checkedItems.length} checked off`}
          </p>
        </div>
        {apiUrl && (
          <a
            href={`${apiUrl}/g/home/shopping-lists/${id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Badge
              variant="outline"
              className="cursor-pointer gap-1 hover:bg-accent"
            >
              <ExternalLink className="size-3" />
              Mealie
            </Badge>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {sortedGroups.map(([label, items]) => (
            <section key={label}>
              <h3 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {label}
              </h3>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {[...items]
                      .sort((a, b) => a.position - b.position)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <Circle className="size-4 shrink-0 text-muted-foreground/30" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {item.display || item.food?.name || item.note}
                            </p>
                            {item.note &&
                              item.food?.name &&
                              item.note !== item.food.name && (
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {item.note}
                                </p>
                              )}
                          </div>
                          {item.quantity > 0 && (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {item.quantity}
                              {item.unit?.name ? ` ${item.unit.name}` : ""}
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
                <p className="text-sm text-muted-foreground">
                  All items checked off!
                </p>
              </CardContent>
            </Card>
          )}

          {checkedItems.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground/50 uppercase">
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
                        <Check className="size-4 shrink-0 text-primary" />
                        <span className="text-sm text-muted-foreground line-through">
                          {item.display || item.food?.name || item.note}
                        </span>
                      </div>
                    ))}
                    {checkedItems.length > 10 && (
                      <div className="px-4 py-2 text-center text-xs text-muted-foreground">
                        +{checkedItems.length - 10} more
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <MergePanel
            items={mergeItems}
            localLists={localLists}
            listName={list.name}
          />
        </div>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/meals/mealie/shopping-lists"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Mealie Shopping Lists
    </Link>
  )
}

function MergePanel({
  items,
  localLists,
  listName,
}: {
  items: Array<MergeItem>
  localLists: Array<{ id: string; name: string; status: string }>
  listName: string
}) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<"new" | "existing">(
    localLists.length > 0 ? "existing" : "new"
  )
  const [newListName, setNewListName] = useState(listName)
  const [targetListId, setTargetListId] = useState(localLists[0]?.id ?? "")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(items.map((i) => i.id))
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const selectedCount = selectedIds.size
  const allSelected = selectedCount === items.length

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onMerge() {
    setError(null)
    setPending(true)
    const selected = items
      .filter((i) => selectedIds.has(i.id))
      .map(({ foodName, quantity, unitName, note, labelName }) => ({
        foodName,
        quantity,
        unitName,
        note,
        labelName,
      }))
    try {
      const result = await mergeMealieListFn({
        data:
          mode === "new"
            ? { mode: "new", newListName: newListName.trim(), items: selected }
            : { mode: "existing", targetListId, items: selected },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      if ("listId" in result) {
        navigate({
          to: "/meals/shopping-lists/$id",
          params: { id: result.listId },
        })
        return
      }
    } catch {
      setError("Merge failed.")
    }
    setPending(false)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Merge className="size-4 text-primary" />
          Merge to Shopping List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Select items from this Mealie list to add to a local shopping list.
          Products are created automatically if they don&apos;t exist.
        </p>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Items to merge</Label>
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  allSelected ? new Set() : new Set(items.map((i) => i.id))
                )
              }
              className="text-[10px] text-primary hover:underline"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="max-h-[300px] space-y-1 overflow-auto">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/30"
              >
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <span className="flex-1 truncate text-xs">
                  {item.display || item.foodName}
                </span>
                {item.labelName && (
                  <Badge
                    variant="outline"
                    className="shrink-0 px-1 py-0 text-[8px]"
                  >
                    {item.labelName}
                  </Badge>
                )}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {selectedCount} of {items.length} selected
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "existing" ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setMode("existing")}
              disabled={localLists.length === 0}
            >
              <ShoppingCart className="size-3" />
              Existing list
            </Button>
            <Button
              type="button"
              variant={mode === "new" ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setMode("new")}
            >
              <Plus className="size-3" />
              New list
            </Button>
          </div>

          {mode === "existing" && localLists.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Target list</Label>
              <select
                className={selectClass}
                value={targetListId}
                onChange={(e) => setTargetListId(e.target.value)}
              >
                {localLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.status.toLowerCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "new" && (
            <div className="space-y-1.5">
              <Label className="text-xs">List name</Label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="h-8 text-xs"
                placeholder="Shopping list name"
              />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button
          onClick={onMerge}
          disabled={
            pending ||
            selectedCount === 0 ||
            (mode === "new" && !newListName.trim()) ||
            (mode === "existing" && !targetListId)
          }
          className="w-full"
          size="sm"
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Merging…
            </>
          ) : (
            <>
              <Merge className="size-3.5" />
              Merge {selectedCount} item{selectedCount !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
