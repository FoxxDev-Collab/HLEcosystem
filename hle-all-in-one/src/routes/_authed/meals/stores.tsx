import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Pencil, Plus, Store as StoreIcon, Trash2 } from "lucide-react"
import {
  createStoreFn,
  deleteStoreFn,
  getStoresPageFn,
  updateStoreFn,
} from "@/server/meals/fns.stores"
import type { StoreRow } from "@/server/meals/stores"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/meals/stores")({
  loader: () => getStoresPageFn(),
  component: StoresPage,
})

function StoresPage() {
  const stores = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StoreRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StoreRow | null>(null)

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Stores</h1>
          <p className="text-sm text-muted-foreground">
            Manage stores where you track prices.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New store
        </Button>
      </div>

      {stores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <StoreIcon className="mb-4 size-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No stores yet</h3>
            <p className="text-sm text-muted-foreground">
              Add your first store to start tracking prices.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              All stores ({stores.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Prices</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div
                        className="size-5 rounded-full border"
                        style={{ backgroundColor: store.color || "#94a3b8" }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {store.name}
                      {!store.isActive && (
                        <Badge variant="outline" className="ml-2">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {store.location || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {store.priceCount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {store.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => setEditTarget(store)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(store)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {createOpen && (
        <StoreDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            refresh()
          }}
        />
      )}
      {editTarget && (
        <StoreDialog
          store={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteStoreDialog
          store={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function StoreDialog({
  store,
  onClose,
  onSaved,
}: {
  store?: StoreRow
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
    const input = {
      name: String(f.get("name") ?? ""),
      location: String(f.get("location") ?? ""),
      color: String(f.get("color") ?? ""),
      notes: String(f.get("notes") ?? ""),
    }
    try {
      const result = store
        ? await updateStoreFn({ data: { id: store.id, ...input } })
        : await createStoreFn({ data: input })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not save store.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{store ? "Edit store" : "New store"}</DialogTitle>
          <DialogDescription>
            A place you shop at — prices are logged per store.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-name">Name</Label>
            <Input
              id="s-name"
              name="name"
              placeholder="e.g. Walmart"
              defaultValue={store?.name ?? ""}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-location">Location</Label>
            <Input
              id="s-location"
              name="location"
              placeholder="e.g. 123 Main St"
              defaultValue={store?.location ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-color">Color</Label>
            <Input
              id="s-color"
              name="color"
              type="color"
              defaultValue={store?.color ?? "#3b82f6"}
              className="h-10 w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-notes">Notes</Label>
            <Input
              id="s-notes"
              name="notes"
              placeholder="Optional notes"
              defaultValue={store?.notes ?? ""}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : store ? "Save" : "Add store"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteStoreDialog({
  store,
  onClose,
  onDeleted,
}: {
  store: StoreRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteStoreFn({ data: { id: store.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete store.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {store.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {store.priceCount > 0
              ? `This also deletes ${store.priceCount} logged price${store.priceCount === 1 ? "" : "s"} for this store.`
              : "This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
