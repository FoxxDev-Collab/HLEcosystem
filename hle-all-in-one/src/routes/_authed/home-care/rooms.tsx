import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { Home, Plus, Save, Trash2 } from "lucide-react"
import {
  createRoomFn,
  deleteRoomFn,
  getRoomsPageFn,
  updateRoomFn,
} from "@/server/home-care/fns.rooms"
import type { RoomRow } from "@/server/home-care/rooms"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/home-care/rooms")({
  loader: () => getRoomsPageFn(),
  component: RoomsPage,
})

function RoomsPage() {
  const rooms = Route.useLoaderData()
  const router = useRouter()
  const [createError, setCreateError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RoomRow | null>(null)

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createRoomFn({
        data: {
          name: String(f.get("name") ?? ""),
          floor: String(f.get("floor") ?? ""),
          description: String(f.get("description") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setCreateError(result.error)
        return
      }
      form.reset()
      router.invalidate()
    } catch {
      setCreateError("Could not create room.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Rooms &amp; Locations</h1>
        <p className="text-sm text-muted-foreground">
          Organize your items by room.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Room</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onCreate}
            className="grid items-end gap-4 sm:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="r-name">Name</Label>
              <Input
                id="r-name"
                name="name"
                placeholder="e.g. Kitchen, Garage"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-floor">Floor</Label>
              <Input
                id="r-floor"
                name="floor"
                placeholder="e.g. 1st Floor, Basement"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-description">Description</Label>
              <Input
                id="r-description"
                name="description"
                placeholder="Optional notes"
              />
            </div>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" /> Add Room
            </Button>
          </form>
          {createError && (
            <p className="mt-2 text-sm text-destructive">{createError}</p>
          )}
        </CardContent>
      </Card>

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Home className="mx-auto mb-3 size-10 opacity-40" />
            <p>No rooms yet. Add rooms to organize your items.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              All Rooms ({rooms.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <RoomTableRow
                    key={room.id}
                    room={room}
                    onDelete={() => setDeleteTarget(room)}
                    onSaved={() => router.invalidate()}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteRoomDialog
          room={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function RoomTableRow({
  room,
  onDelete,
  onSaved,
}: {
  room: RoomRow
  onDelete: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(room.name)
  const [floor, setFloor] = useState(room.floor ?? "")
  const [description, setDescription] = useState(room.description ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save() {
    if (!name.trim()) return
    setError(null)
    setPending(true)
    try {
      const result = await updateRoomFn({
        data: { id: room.id, name, floor, description },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      onSaved()
    } catch {
      setError("Could not save room.")
    } finally {
      setPending(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
          aria-label="Room name"
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </TableCell>
      <TableCell>
        <Input
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          placeholder="—"
          className="h-8 text-sm"
          aria-label="Floor"
        />
      </TableCell>
      <TableCell>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="—"
          className="h-8 text-sm"
          aria-label="Description"
        />
      </TableCell>
      <TableCell className="text-center">
        <Link
          to="/home-care/items"
          search={{ roomId: room.id }}
          className="text-sm hover:underline"
        >
          {room.itemCount}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="Save changes"
            disabled={pending || !name.trim()}
            onClick={save}
          >
            <Save className="size-3.5 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="Delete room"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function DeleteRoomDialog({
  room,
  onClose,
  onDeleted,
}: {
  room: RoomRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteRoomFn({ data: { id: room.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete room.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {room.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Items in this room are kept but lose their room assignment.
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
