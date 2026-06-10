import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import {
  addProjectItemFn,
  deleteProjectFn,
  deleteProjectItemFn,
  getBudgetPlannerProjectFn,
  toggleProjectItemPurchasedFn,
  updateProjectFn,
  updateProjectItemFn,
  updateProjectStatusFn,
} from "@/server/finance/fns.budget-planner"
import type {
  ProjectItemRow,
  ProjectRow,
} from "@/server/finance/budget-planner"
import { PROJECT_STATUSES } from "@/lib/finance-constants"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export const Route = createFileRoute("/_authed/finance/budget-planner/$id")({
  loader: ({ params }) =>
    getBudgetPlannerProjectFn({ data: { id: params.id } }),
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { project, items } = Route.useLoaderData()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editItem, setEditItem] = useState<ProjectItemRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" render={<Link to="/finance/budget-planner" />}>
          <ArrowLeft className="size-4" /> Budget Planner
        </Button>
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    )
  }

  const remaining = project.totalCost - project.purchasedCost

  function refresh() {
    router.invalidate()
  }

  async function onSetStatus(status: (typeof PROJECT_STATUSES)[number]) {
    if (!project) return
    setError(null)
    const result = await updateProjectStatusFn({
      data: { id: project.id, status },
    })
    if ("error" in result && typeof result.error === "string") {
      setError(result.error)
      return
    }
    refresh()
  }

  async function onAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!project) return
    setError(null)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await addProjectItemFn({
        data: {
          projectId: project.id,
          name: String(f.get("name") ?? ""),
          description: "",
          quantity: parseInt(String(f.get("quantity") ?? "1"), 10) || 1,
          unitCost: Number(f.get("unitCost") ?? 0) || 0,
          referenceUrl: String(f.get("referenceUrl") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      refresh()
    } catch {
      setError("Could not add item.")
    }
  }

  async function onToggleItem(item: ProjectItemRow) {
    setError(null)
    const result = await toggleProjectItemPurchasedFn({
      data: { id: item.id },
    })
    if ("error" in result && typeof result.error === "string") {
      setError(result.error)
      return
    }
    refresh()
  }

  async function onDeleteItem(item: ProjectItemRow) {
    setError(null)
    const result = await deleteProjectItemFn({ data: { id: item.id } })
    if ("error" in result && typeof result.error === "string") {
      setError(result.error)
      return
    }
    refresh()
  }

  async function onDeleteProject() {
    if (!project) return
    setPending(true)
    try {
      const result = await deleteProjectFn({ data: { id: project.id } })
      if ("error" in result && typeof result.error === "string") {
        setPending(false)
        return
      }
      navigate({ to: "/finance/budget-planner" })
    } catch {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            render={<Link to="/finance/budget-planner" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROJECT_STATUSES.map((status) => (
            <Button
              key={status}
              variant={project.status === status ? "default" : "outline"}
              size="sm"
              onClick={() => onSetStatus(status)}
            >
              {status}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit Project
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(project.totalCost)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Purchased</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(project.purchasedCost)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(remaining)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onAddItem}
            className="grid items-end gap-3 sm:grid-cols-6"
          >
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                name="name"
                placeholder="e.g. Quartz Countertop"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-quantity">Qty</Label>
              <Input
                id="item-quantity"
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-unitCost">Unit Cost</Label>
              <Input
                id="item-unitCost"
                name="unitCost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-referenceUrl">Link</Label>
              <Input
                id="item-referenceUrl"
                name="referenceUrl"
                type="url"
                placeholder="https://..."
              />
            </div>
            <Button type="submit">
              <Plus className="size-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No items yet
            </p>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-4 py-3 ${
                    item.isPurchased ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Button
                      variant={item.isPurchased ? "default" : "outline"}
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title={
                        item.isPurchased
                          ? "Mark not purchased"
                          : "Mark purchased"
                      }
                      onClick={() => onToggleItem(item)}
                    >
                      {item.isPurchased && <Check className="size-3.5" />}
                    </Button>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          item.isPurchased ? "line-through" : ""
                        }`}
                      >
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity} x {formatCurrency(item.unitCost)}
                        {item.referenceUrl && (
                          <a
                            href={item.referenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 inline-flex items-center gap-1 text-blue-500 hover:underline"
                          >
                            <ExternalLink className="size-3" /> Link
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-sm font-medium tabular-nums">
                      {formatCurrency(item.lineTotal)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      title="Edit"
                      onClick={() => setEditItem(item)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={() => onDeleteItem(item)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editOpen && (
        <ProjectEditDialog
          project={project}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            refresh()
          }}
        />
      )}

      {editItem && (
        <ItemEditDialog
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null)
            refresh()
          }}
        />
      )}

      {deleteOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the project and all {project.itemCount}{" "}
                item{project.itemCount !== 1 ? "s" : ""}. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  onDeleteProject()
                }}
                disabled={pending}
              >
                {pending ? "Deleting…" : "Delete Permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

function ProjectEditDialog({
  project,
  onClose,
  onSaved,
}: {
  project: ProjectRow
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
      const result = await updateProjectFn({
        data: {
          id: project.id,
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? ""),
          targetDate: String(f.get("targetDate") ?? "") || null,
          color: String(f.get("color") ?? "#6366f1"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not update project.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ep-name">Name</Label>
            <Input
              id="ep-name"
              name="name"
              defaultValue={project.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-description">Description</Label>
            <Input
              id="ep-description"
              name="description"
              defaultValue={project.description ?? ""}
              placeholder="Optional details"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ep-targetDate">Target Date</Label>
              <Input
                id="ep-targetDate"
                name="targetDate"
                type="date"
                defaultValue={project.targetDate ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-color">Color</Label>
              <Input
                id="ep-color"
                name="color"
                type="color"
                defaultValue={project.color ?? "#6366f1"}
                className="h-9"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ItemEditDialog({
  item,
  onClose,
  onSaved,
}: {
  item: ProjectItemRow
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
      const result = await updateProjectItemFn({
        data: {
          id: item.id,
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? ""),
          quantity: parseInt(String(f.get("quantity") ?? "1"), 10) || 1,
          unitCost: Number(f.get("unitCost") ?? 0) || 0,
          referenceUrl: String(f.get("referenceUrl") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not update item.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            Quantity × unit cost sets the line total.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ei-name">Name</Label>
            <Input id="ei-name" name="name" defaultValue={item.name} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ei-quantity">Quantity</Label>
              <Input
                id="ei-quantity"
                name="quantity"
                type="number"
                min="1"
                defaultValue={item.quantity}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei-unitCost">Unit Cost</Label>
              <Input
                id="ei-unitCost"
                name="unitCost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={item.unitCost}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ei-referenceUrl">Reference Link</Label>
            <Input
              id="ei-referenceUrl"
              name="referenceUrl"
              type="url"
              defaultValue={item.referenceUrl ?? ""}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ei-description">Description</Label>
            <Input
              id="ei-description"
              name="description"
              defaultValue={item.description ?? ""}
              placeholder="Optional"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
