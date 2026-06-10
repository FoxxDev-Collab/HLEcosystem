import { useState } from "react"
import { Package, Plus, Trash2 } from "lucide-react"
import type {
  PackingCategory,
  PackingItemRow,
  PackingListWithItems,
} from "@/server/travel/detail"
import {
  addPackingItemFn,
  createPackingListFn,
  deletePackingItemFn,
  deletePackingListFn,
  togglePackingItemFn,
} from "@/server/travel/fns.detail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  ConfirmDeleteDialog,
  PACKING_CATEGORIES,
  enumLabel,
  selectClass,
} from "./trip-shared"

export function TripPackingTab({
  tripId,
  packingLists,
  onChanged,
}: {
  tripId: string
  packingLists: Array<PackingListWithItems>
  onChanged: () => void
}) {
  const [addListOpen, setAddListOpen] = useState(false)
  const [addItemListId, setAddItemListId] = useState<string | null>(null)
  const [deleteListTarget, setDeleteListTarget] =
    useState<PackingListWithItems | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const allItems = packingLists.flatMap((l) => l.items)
  const packedCount = allItems.filter((i) => i.isPacked).length
  const totalCount = allItems.length
  const packedPercent =
    totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0

  async function runItemAction(
    action: () => Promise<{ ok: true } | { error: string }>,
    fallback: string
  ) {
    setActionError(null)
    try {
      const result = await action()
      if ("error" in result && typeof result.error === "string") {
        setActionError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setActionError(fallback)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Packing lists</h2>
        <Button size="sm" onClick={() => setAddListOpen(true)}>
          <Plus className="size-3.5" /> New list
        </Button>
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {totalCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Overall progress</span>
              <span className="text-sm text-muted-foreground">
                {packedCount}/{totalCount} packed ({packedPercent}%)
              </span>
            </div>
            <Progress value={packedPercent} />
          </CardContent>
        </Card>
      )}

      {packingLists.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No packing lists yet. Create one to start packing.
          </CardContent>
        </Card>
      ) : (
        packingLists.map((list) => {
          const listPacked = list.items.filter((i) => i.isPacked).length
          const listTotal = list.items.length
          const listPercent =
            listTotal > 0 ? Math.round((listPacked / listTotal) * 100) : 0
          return (
            <Card key={list.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="size-4" />
                      {list.name}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({listPacked}/{listTotal})
                      </span>
                    </CardTitle>
                    {listTotal > 0 && (
                      <div className="mt-2 w-48">
                        <Progress value={listPercent} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddItemListId(list.id)}
                    >
                      <Plus className="size-3.5" /> Item
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete list"
                      onClick={() => setDeleteListTarget(list)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {list.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items yet.</p>
                ) : (
                  <div className="space-y-1">
                    {list.items.map((item) => (
                      <PackingItemRowView
                        key={item.id}
                        item={item}
                        onToggle={() =>
                          runItemAction(
                            () =>
                              togglePackingItemFn({ data: { id: item.id } }),
                            "Could not update item."
                          )
                        }
                        onDelete={() =>
                          runItemAction(
                            () =>
                              deletePackingItemFn({ data: { id: item.id } }),
                            "Could not delete item."
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      {addListOpen && (
        <AddListDialog
          tripId={tripId}
          onClose={() => setAddListOpen(false)}
          onSaved={() => {
            setAddListOpen(false)
            onChanged()
          }}
        />
      )}
      {addItemListId && (
        <AddItemDialog
          listId={addItemListId}
          onClose={() => setAddItemListId(null)}
          onSaved={() => {
            setAddItemListId(null)
            onChanged()
          }}
        />
      )}
      {deleteListTarget && (
        <ConfirmDeleteDialog
          title={`Delete ${deleteListTarget.name}?`}
          description={`The list and its ${deleteListTarget.items.length} item${deleteListTarget.items.length === 1 ? "" : "s"} will be permanently removed.`}
          onConfirm={() =>
            deletePackingListFn({ data: { id: deleteListTarget.id } })
          }
          onClose={() => setDeleteListTarget(null)}
          onDone={() => {
            setDeleteListTarget(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function PackingItemRowView({
  item,
  onToggle,
  onDelete,
}: {
  item: PackingItemRow
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <Checkbox checked={item.isPacked} onCheckedChange={onToggle} />
        <span
          className={`text-sm ${item.isPacked ? "text-muted-foreground line-through" : ""}`}
        >
          {item.name}
          {item.quantity > 1 && (
            <span className="text-muted-foreground"> ×{item.quantity}</span>
          )}
        </span>
        <Badge variant="outline" className="text-xs capitalize">
          {enumLabel(item.category)}
        </Badge>
        {item.notes && (
          <span className="text-xs text-muted-foreground">{item.notes}</span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        title="Delete item"
        onClick={onDelete}
      >
        <Trash2 className="size-3 text-destructive" />
      </Button>
    </div>
  )
}

function AddListDialog({
  tripId,
  onClose,
  onSaved,
}: {
  tripId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createPackingListFn({
        data: { tripId, name: String(f.get("name") ?? "") },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not create packing list.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create packing list</DialogTitle>
          <DialogDescription>
            Group what you&apos;re packing — one list per bag works well.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="list-name">List name *</Label>
            <Input
              id="list-name"
              name="name"
              required
              autoFocus
              placeholder="e.g., Carry-on, Checked Bag"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create list"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddItemDialog({
  listId,
  onClose,
  onSaved,
}: {
  listId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const quantity = parseInt(String(f.get("quantity") ?? "1"), 10)
    const category: PackingCategory =
      PACKING_CATEGORIES.find((c) => c === f.get("category")) ?? "OTHER"
    try {
      const result = await addPackingItemFn({
        data: {
          packingListId: listId,
          name: String(f.get("name") ?? ""),
          category,
          quantity: Number.isNaN(quantity) ? 1 : quantity,
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add item.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add packing item</DialogTitle>
          <DialogDescription>Add an item to this list.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Item name *</Label>
            <Input id="item-name" name="name" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-category">Category</Label>
              <select
                id="item-category"
                name="category"
                className={selectClass}
                defaultValue="OTHER"
              >
                {PACKING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-qty">Quantity</Label>
              <Input
                id="item-qty"
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-notes">Notes</Label>
            <Input id="item-notes" name="notes" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
