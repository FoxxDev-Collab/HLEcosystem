import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react"
import {
  addTodoItemFn,
  deleteTodoItemFn,
  deleteTodoListFn,
  getTodoListPageFn,
  toggleTodoItemFn,
  updateTodoItemFn,
  updateTodoListFn,
} from "@/server/hub/fns.todos"
import type { TodoItemRow, TodoListRow } from "@/server/hub/todos"
import type { MemberWithUser } from "@/lib/types"
import { formatDateShort, toDateInputValue } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/hub/todos/$listId")({
  loader: ({ params }) =>
    getTodoListPageFn({ data: { listId: params.listId } }),
  component: TodoListDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

function TodoListDetailPage() {
  const { list, items, members } = Route.useLoaderData()
  const router = useRouter()
  const [editListOpen, setEditListOpen] = useState(false)
  const [deleteListOpen, setDeleteListOpen] = useState(false)
  const [editItem, setEditItem] = useState<TodoItemRow | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [addPending, setAddPending] = useState(false)

  if (!list) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          List not found. It may have been deleted.
        </p>
        <Button variant="outline" render={<Link to="/hub/todos" />}>
          <ArrowLeft className="size-4" /> Back to lists
        </Button>
      </div>
    )
  }

  const memberMap = new Map(
    members.map((m) => [m.userId, m.displayName || m.name])
  )
  const pendingItems = items.filter((i) => i.status !== "DONE")
  const doneItems = items.filter((i) => i.status === "DONE")

  function refresh() {
    router.invalidate()
  }

  async function onAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!list) return
    const form = e.currentTarget
    const f = new FormData(form)
    setAddError(null)
    setAddPending(true)
    try {
      const result = await addTodoItemFn({
        data: {
          listId: list.id,
          title: String(f.get("title") ?? ""),
          notes: null,
          dueDate: String(f.get("dueDate") ?? "") || null,
          assigneeId: String(f.get("assigneeId") ?? "") || null,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setAddError(result.error)
        setAddPending(false)
        return
      }
      form.reset()
      setAddPending(false)
      refresh()
    } catch {
      setAddError("Could not add task.")
      setAddPending(false)
    }
  }

  async function onToggle(itemId: string) {
    await toggleTodoItemFn({ data: { itemId } })
    refresh()
  }

  async function onDeleteItem(itemId: string) {
    await deleteTodoItemFn({ data: { itemId } })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link to="/hub/todos" />}
            title="Back to lists"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <div
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: list.color || "#6b7280" }}
              />
              <h1 className="text-xl font-semibold">{list.name}</h1>
            </div>
            {list.description && (
              <p className="ml-5 text-sm text-muted-foreground">
                {list.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Edit list"
            onClick={() => setEditListOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            title="Delete list"
            onClick={() => setDeleteListOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onAddItem} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Input name="title" placeholder="Add a task..." required />
              </div>
              <div className="w-full sm:w-40">
                <Input name="dueDate" type="date" className="text-sm" />
              </div>
              <div className="w-full sm:w-44">
                <select
                  name="assigneeId"
                  className={selectClass}
                  defaultValue=""
                  aria-label="Assign to"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName || m.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="submit"
                disabled={addPending}
                className="w-full sm:w-auto"
              >
                <Plus className="size-4" />
                {addPending ? "Adding…" : "Add"}
              </Button>
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
          </form>
        </CardContent>
      </Card>

      {pendingItems.length === 0 && doneItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-12 text-center">
          <CheckCircle2 className="size-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">No tasks yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a task above to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/30"
            >
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-primary"
                title="Mark done"
                onClick={() => onToggle(item.id)}
              >
                <Circle className="size-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.title}</p>
                {item.notes && (
                  <p className="line-clamp-1 text-sm text-muted-foreground">
                    {item.notes}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-3">
                  {item.dueDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatDateShort(item.dueDate)}
                    </span>
                  )}
                  {item.assigneeId && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="size-3" />
                      {memberMap.get(item.assigneeId) ?? "Unknown"}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                title="Edit task"
                onClick={() => setEditItem(item)}
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                title="Delete task"
                onClick={() => onDeleteItem(item.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}

          {doneItems.length > 0 && (
            <div className="pt-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Completed ({doneItems.length})
              </p>
              <div className="space-y-2">
                {doneItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border p-3 opacity-60 transition-opacity hover:opacity-100"
                  >
                    <button
                      type="button"
                      className="text-primary transition-colors hover:text-primary/80"
                      title="Mark as not done"
                      onClick={() => onToggle(item.id)}
                    >
                      <CheckCircle2 className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground line-through">
                        {item.title}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        {item.assigneeId && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="size-3" />
                            {memberMap.get(item.assigneeId) ?? "Unknown"}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                      title="Delete task"
                      onClick={() => onDeleteItem(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {editListOpen && (
        <EditListDialog
          list={list}
          onClose={() => setEditListOpen(false)}
          onSaved={() => {
            setEditListOpen(false)
            refresh()
          }}
        />
      )}
      {deleteListOpen && (
        <DeleteListDialog
          list={list}
          onClose={() => setDeleteListOpen(false)}
          onDeleted={() => {
            setDeleteListOpen(false)
            router.navigate({ to: "/hub/todos" })
          }}
        />
      )}
      {editItem && (
        <EditItemDialog
          item={editItem}
          members={members}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function EditListDialog({
  list,
  onClose,
  onSaved,
}: {
  list: TodoListRow
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
      await updateTodoListFn({
        data: {
          listId: list.id,
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? "") || null,
          color: String(f.get("color") ?? "") || null,
        },
      })
      onSaved()
    } catch {
      setError("Could not update list.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit list</DialogTitle>
          <DialogDescription>
            Rename the list, update its description, or change its color.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="el-name">Name</Label>
            <Input
              id="el-name"
              name="name"
              defaultValue={list.name}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="el-description">Description</Label>
            <Textarea
              id="el-description"
              name="description"
              rows={2}
              defaultValue={list.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    defaultChecked={list.color === color}
                    className="peer sr-only"
                  />
                  <div
                    className="size-7 rounded-full border-2 border-transparent transition-all peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-foreground/20 peer-checked:ring-offset-2 peer-checked:ring-offset-background"
                    style={{ backgroundColor: color }}
                  />
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteListDialog({
  list,
  onClose,
  onDeleted,
}: {
  list: TodoListRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      await deleteTodoListFn({ data: { listId: list.id } })
      onDeleted()
    } catch {
      setError("Could not delete list.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {list.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The list and all of its tasks will be permanently deleted.
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

function EditItemDialog({
  item,
  members,
  onClose,
  onSaved,
}: {
  item: TodoItemRow
  members: Array<MemberWithUser>
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
      const result = await updateTodoItemFn({
        data: {
          itemId: item.id,
          title: String(f.get("title") ?? ""),
          notes: String(f.get("notes") ?? "") || null,
          dueDate: String(f.get("dueDate") ?? "") || null,
          assigneeId: String(f.get("assigneeId") ?? "") || null,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not update task.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Update the title, notes, due date, or assignee.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ei-title">Title</Label>
            <Input
              id="ei-title"
              name="title"
              defaultValue={item.title}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ei-notes">Notes</Label>
            <Textarea
              id="ei-notes"
              name="notes"
              rows={2}
              defaultValue={item.notes ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ei-due">Due date</Label>
              <Input
                id="ei-due"
                name="dueDate"
                type="date"
                defaultValue={toDateInputValue(item.dueDate)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei-assignee">Assignee</Label>
              <select
                id="ei-assignee"
                name="assigneeId"
                className={selectClass}
                defaultValue={item.assigneeId ?? ""}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName || m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
