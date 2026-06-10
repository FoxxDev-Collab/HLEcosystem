import { useState } from "react"
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { Copy, ShoppingCart, Sparkles, Trash2 } from "lucide-react"
import {
  createListFn,
  deleteListFn,
  duplicateListFn,
  getShoppingListsPageFn,
} from "@/server/meals/fns.shopping-lists"
import type { ShoppingListRow } from "@/server/meals/shopping-lists"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/meals/shopping-lists/")({
  loader: () => getShoppingListsPageFn(),
  component: ShoppingListsPage,
})

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  COMPLETED: "outline",
}

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
}

function ShoppingListsPage() {
  const lists = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ShoppingListRow | null>(null)

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return
    setPending(true)
    try {
      const result = await createListFn({
        data: { name: name.trim(), notes },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        setName("")
        setNotes("")
        router.invalidate()
      }
    } catch {
      setError("Could not create the list.")
    }
    setPending(false)
  }

  async function onDuplicate(id: string) {
    try {
      const result = await duplicateListFn({ data: { id } })
      if ("id" in result && result.id) {
        navigate({
          to: "/meals/shopping-lists/$id",
          params: { id: result.id },
        })
      }
    } catch {
      setError("Could not duplicate the list.")
    }
  }

  async function onDelete() {
    if (!deleteTarget) return
    setPending(true)
    try {
      const result = await deleteListFn({ data: { id: deleteTarget.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      }
      setDeleteTarget(null)
      router.invalidate()
    } catch {
      setError("Could not delete the list.")
    }
    setPending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Shopping Lists</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage your shopping lists
          </p>
        </div>
        <Link to="/meals/shopping-lists/generate">
          <Button variant="outline">
            <Sparkles className="size-4" />
            Smart list
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New List</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label htmlFor="list-name">List Name *</Label>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly Groceries"
                required
              />
            </div>
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label htmlFor="list-notes">Notes</Label>
              <Input
                id="list-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create List"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="mb-4 size-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No shopping lists yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first list to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Lists ({lists.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <Link
                        to="/meals/shopping-lists/$id"
                        params={{ id: list.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {list.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[list.status]}>
                        {statusLabels[list.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {list.itemCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(list.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Duplicate"
                        onClick={() => onDuplicate(list.id)}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(list)}
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

      {deleteTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete &quot;{deleteTarget.name}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                The list and its {deleteTarget.itemCount} item
                {deleteTarget.itemCount !== 1 ? "s" : ""} are removed. Products
                stay in your catalog.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  onDelete()
                }}
                disabled={pending}
              >
                {pending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
