import { useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { Plus, Star, Trash2 } from "lucide-react"
import type { WishlistRow } from "@/server/finance/wishlist"
import {
  createWishlistFn,
  deleteWishlistFn,
  getWishlistsPageFn,
} from "@/server/finance/fns.wishlist"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/finance/wishlist/")({
  loader: () => getWishlistsPageFn(),
  component: WishlistsPage,
})

function WishlistsPage() {
  const { wishlists } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState<WishlistRow | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Wishlists</h1>
        <p className="text-sm text-muted-foreground">
          Plan purchases with price ranges and running totals
        </p>
      </div>

      <NewWishlistCard
        onCreated={(id) =>
          navigate({ to: "/finance/wishlist/$id", params: { id } })
        }
      />

      {wishlists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No wishlists yet. Create one to start planning purchases.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wishlists.map((list) => {
            const unpurchased = list.itemCount - list.purchasedCount
            return (
              <Card
                key={list.id}
                className="h-full transition-colors hover:bg-accent/30"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Link to="/finance/wishlist/$id" params={{ id: list.id }}>
                      <CardTitle className="cursor-pointer text-base hover:underline">
                        {list.name}
                      </CardTitle>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(list)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {list.description && (
                    <CardDescription className="line-clamp-2">
                      {list.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.estimatedTotal > 0 && (
                    <div className="text-xl font-bold tabular-nums">
                      ~{formatCurrency(list.estimatedTotal)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {unpurchased} {unpurchased === 1 ? "item" : "items"}
                    </Badge>
                    {list.purchasedCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {list.purchasedCount} purchased
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteTarget.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the list and all {deleteTarget.itemCount} of its
                items. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  deleteWishlistFn({ data: { id: deleteTarget.id } }).then(
                    () => {
                      setDeleteTarget(null)
                      router.invalidate()
                    }
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

function NewWishlistCard({ onCreated }: { onCreated: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createWishlistFn({
        data: {
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? ""),
        },
      })
      onCreated(result.id)
    } catch {
      setError("Could not create wishlist.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Wishlist</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-3"
        >
          <div className="space-y-1">
            <Label htmlFor="wishlist-name">List Name</Label>
            <Input
              id="wishlist-name"
              name="name"
              placeholder="e.g. Home Office Upgrades"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wishlist-description">Description</Label>
            <Input
              id="wishlist-description"
              name="description"
              placeholder="Optional details"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" /> Create List
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-3">{error}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
