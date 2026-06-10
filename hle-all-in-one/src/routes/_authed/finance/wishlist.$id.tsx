import { useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import type { WishlistItemRow } from "@/server/finance/wishlist"
import {
  addWishlistItemFn,
  deleteWishlistFn,
  deleteWishlistItemFn,
  getWishlistDetailFn,
  toggleWishlistItemFn,
  updateWishlistFn,
} from "@/server/finance/fns.wishlist"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export const Route = createFileRoute("/_authed/finance/wishlist/$id")({
  loader: ({ params }) => getWishlistDetailFn({ data: { id: params.id } }),
  component: WishlistDetailPage,
})

function itemAvg(item: WishlistItemRow): number {
  const low = item.lowPrice ?? 0
  const high = item.highPrice ?? 0
  if (low && high) return (low + high) / 2
  return low || high
}

function WishlistDetailPage() {
  const { wishlist, items } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!wishlist) {
    return (
      <div className="space-y-4">
        <Link
          to="/finance/wishlist"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Wishlists
        </Link>
        <p className="text-sm text-muted-foreground">Wishlist not found.</p>
      </div>
    )
  }

  function refresh() {
    router.invalidate()
  }

  const unpurchased = items.filter((i) => !i.isPurchased)
  const purchased = items.filter((i) => i.isPurchased)

  const totalLow = unpurchased.reduce((sum, i) => sum + (i.lowPrice ?? 0), 0)
  const totalHigh = unpurchased.reduce((sum, i) => sum + (i.highPrice ?? 0), 0)
  const totalAvg = unpurchased.reduce((sum, i) => sum + itemAvg(i), 0)

  return (
    <div className="space-y-6">
      <Link
        to="/finance/wishlist"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Wishlists
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{wishlist.name}</h1>
          {wishlist.description && (
            <p className="text-sm text-muted-foreground">
              {wishlist.description}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" /> Delete List
        </Button>
      </div>

      <EditListCard
        id={wishlist.id}
        name={wishlist.name}
        description={wishlist.description}
        onSaved={refresh}
      />

      {unpurchased.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <EstimateCard label="Low Estimate" value={totalLow} />
          <EstimateCard label="Average Estimate" value={totalAvg} />
          <EstimateCard label="High Estimate" value={totalHigh} />
        </div>
      )}

      <AddItemCard wishlistId={wishlist.id} onAdded={refresh} />

      <Card>
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No items yet. Add one above.
            </p>
          ) : (
            <div className="divide-y">
              {unpurchased.map((item) => (
                <ItemRow key={item.id} item={item} onChanged={refresh} />
              ))}
              {purchased.length > 0 && (
                <>
                  <div className="py-2 pt-4">
                    <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Purchased
                    </span>
                  </div>
                  {purchased.map((item) => (
                    <ItemRow key={item.id} item={item} onChanged={refresh} />
                  ))}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {deleteOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {wishlist.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the list and all of its items. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  deleteWishlistFn({ data: { id: wishlist.id } }).then(() =>
                    navigate({ to: "/finance/wishlist" })
                  )
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function EstimateCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {formatCurrency(value)}
        </div>
      </CardContent>
    </Card>
  )
}

function ItemRow({
  item,
  onChanged,
}: {
  item: WishlistItemRow
  onChanged: () => void
}) {
  const low = item.lowPrice ?? 0
  const high = item.highPrice ?? 0
  const avg = itemAvg(item)

  async function onToggle() {
    await toggleWishlistItemFn({ data: { id: item.id } })
    onChanged()
  }

  async function onDelete() {
    await deleteWishlistItemFn({ data: { id: item.id } })
    onChanged()
  }

  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${item.isPurchased ? "opacity-60" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant={item.isPurchased ? "default" : "outline"}
          size="icon"
          className="size-7 shrink-0"
          title={item.isPurchased ? "Mark not purchased" : "Mark purchased"}
          onClick={onToggle}
        >
          {item.isPurchased && <Check className="size-3.5" />}
        </Button>
        <div className="min-w-0">
          <div
            className={`text-sm font-medium ${item.isPurchased ? "line-through" : ""}`}
          >
            {item.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {low > 0 && high > 0 ? (
              <>
                {formatCurrency(low)} – {formatCurrency(high)} · avg{" "}
                {formatCurrency(avg)}
              </>
            ) : avg > 0 ? (
              formatCurrency(avg)
            ) : (
              "No price set"
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-blue-500 hover:underline"
              >
                <ExternalLink className="size-3" />
                Link
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!item.isPurchased && avg > 0 && (
          <span className="text-sm font-medium tabular-nums">
            {formatCurrency(avg)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function EditListCard({
  id,
  name,
  description,
  onSaved,
}: {
  id: string
  name: string
  description: string | null
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
      await updateWishlistFn({
        data: {
          id,
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? ""),
        },
      })
      onSaved()
    } catch {
      setError("Could not update list.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Edit List</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-3"
        >
          <div className="space-y-1">
            <Label htmlFor="edit-list-name">Name</Label>
            <Input
              id="edit-list-name"
              name="name"
              defaultValue={name}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-list-description">Description</Label>
            <Input
              id="edit-list-description"
              name="description"
              defaultValue={description ?? ""}
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Pencil className="size-4" /> Update
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-3">{error}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function AddItemCard({
  wishlistId,
  onAdded,
}: {
  wishlistId: string
  onAdded: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const lowStr = String(f.get("lowPrice") ?? "").trim()
    const highStr = String(f.get("highPrice") ?? "").trim()
    try {
      const result = await addWishlistItemFn({
        data: {
          wishlistId,
          name: String(f.get("name") ?? ""),
          lowPrice: lowStr ? Number(lowStr) : null,
          highPrice: highStr ? Number(highStr) : null,
          url: String(f.get("url") ?? ""),
        },
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      form.reset()
      onAdded()
    } catch {
      setError("Could not add item.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid items-end gap-3 sm:grid-cols-5">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                name="name"
                placeholder="e.g. Standing Desk"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-low">Low Price</Label>
              <Input
                id="item-low"
                name="lowPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-high">High Price</Label>
              <Input
                id="item-high"
                name="highPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-url">Link (optional)</Label>
            <Input
              id="item-url"
              name="url"
              type="url"
              placeholder="https://example.com/product"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
