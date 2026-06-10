import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  ListChecks,
  Plus,
  Power,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react"
import {
  addChoreAssignmentFn,
  createChoreFn,
  deleteChoreFn,
  getManageChoresFn,
  removeChoreAssignmentFn,
  toggleChoreActiveFn,
} from "@/server/home-care/fns.chores"
import type {
  ChoreAssignmentRow,
  ChoreFrequency,
  ChoreRow,
  RotationMode,
} from "@/server/home-care/chores"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

export const Route = createFileRoute("/_authed/home-care/chores/manage")({
  loader: () => getManageChoresFn(),
  component: ManageChoresPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const FREQUENCIES: Array<ChoreFrequency> = [
  "DAILY",
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "CUSTOM_DAYS",
]

const ROTATION_MODES: Array<RotationMode> = [
  "NONE",
  "ROUND_ROBIN",
  "WEEKLY_ROTATION",
]

function frequencyLabel(f: ChoreFrequency): string {
  switch (f) {
    case "DAILY":
      return "Daily"
    case "WEEKLY":
      return "Weekly"
    case "BI_WEEKLY":
      return "Every 2 Weeks"
    case "MONTHLY":
      return "Monthly"
    case "CUSTOM_DAYS":
      return "Custom Days"
  }
}

function rotationLabel(r: RotationMode): string {
  switch (r) {
    case "NONE":
      return "None"
    case "ROUND_ROBIN":
      return "Round Robin"
    case "WEEKLY_ROTATION":
      return "Weekly Rotation"
  }
}

type Member = { membershipId: string; displayName: string }

function ManageChoresPage() {
  const { chores, assignments, rooms, members } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<ChoreRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeChores = chores.filter((c) => c.isActive)
  const inactiveChores = chores.filter((c) => !c.isActive)
  const assignmentsByChore = new Map<string, Array<ChoreAssignmentRow>>()
  for (const a of assignments) {
    const list = assignmentsByChore.get(a.choreId) ?? []
    list.push(a)
    assignmentsByChore.set(a.choreId, list)
  }

  async function runMutation(fn: () => Promise<{ error?: string }>) {
    setError(null)
    try {
      const result = await fn()
      if (result.error) {
        setError(result.error)
        return
      }
      router.invalidate()
    } catch {
      setError("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Manage Chores</h1>
        <p className="text-sm text-muted-foreground">
          Define chores, assign household members, and set up rotations.
        </p>
      </div>

      <CreateChoreCard
        rooms={rooms}
        members={members}
        onSaved={() => router.invalidate()}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {chores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ListChecks className="mx-auto mb-3 size-10 opacity-40" />
            <p>No chores defined yet. Create one above to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeChores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Chores ({activeChores.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ChoreList
                  chores={activeChores}
                  assignmentsByChore={assignmentsByChore}
                  members={members}
                  onToggle={(id) =>
                    runMutation(() => toggleChoreActiveFn({ data: { id } }))
                  }
                  onDelete={setDeleteTarget}
                  onAddAssignment={(choreId, assigneeId) =>
                    runMutation(() =>
                      addChoreAssignmentFn({ data: { choreId, assigneeId } })
                    )
                  }
                  onRemoveAssignment={(id) =>
                    runMutation(() => removeChoreAssignmentFn({ data: { id } }))
                  }
                />
              </CardContent>
            </Card>
          )}

          {inactiveChores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  Inactive Chores ({inactiveChores.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="opacity-60">
                <ChoreList
                  chores={inactiveChores}
                  assignmentsByChore={assignmentsByChore}
                  members={members}
                  onToggle={(id) =>
                    runMutation(() => toggleChoreActiveFn({ data: { id } }))
                  }
                  onDelete={setDeleteTarget}
                  onAddAssignment={(choreId, assigneeId) =>
                    runMutation(() =>
                      addChoreAssignmentFn({ data: { choreId, assigneeId } })
                    )
                  }
                  onRemoveAssignment={(id) =>
                    runMutation(() => removeChoreAssignmentFn({ data: { id } }))
                  }
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {deleteTarget && (
        <DeleteChoreDialog
          chore={deleteTarget}
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

function CreateChoreCard({
  rooms,
  members,
  onSaved,
}: {
  rooms: Array<{ id: string; name: string }>
  members: Array<Member>
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [assigneeIds, setAssigneeIds] = useState<Array<string>>([])

  function toggleAssignee(id: string, checked: boolean) {
    setAssigneeIds((prev) =>
      checked ? [...prev, id] : prev.filter((a) => a !== id)
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const estimatedMinutes = String(f.get("estimatedMinutes") ?? "").trim()
    try {
      const result = await createChoreFn({
        data: {
          title: String(f.get("title") ?? ""),
          description: String(f.get("description") ?? ""),
          roomId: String(f.get("roomId") ?? ""),
          frequency: String(f.get("frequency") ?? "WEEKLY") as ChoreFrequency,
          customIntervalDays: null,
          rotationMode: String(f.get("rotationMode") ?? "NONE") as RotationMode,
          pointValue: Number(f.get("pointValue") ?? 0) || 0,
          estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
          assigneeIds,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setAssigneeIds([])
      setPending(false)
      onSaved()
    } catch {
      setError("Could not create chore.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Chore</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="c-title">Title</Label>
              <Input
                id="c-title"
                name="title"
                placeholder="e.g. Vacuum Living Room"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-room">Room</Label>
              <select id="c-room" name="roomId" className={selectClass}>
                <option value="">Optional</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-frequency">Frequency</Label>
              <select
                id="c-frequency"
                name="frequency"
                className={selectClass}
                defaultValue="WEEKLY"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {frequencyLabel(f)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-rotation">Rotation Mode</Label>
              <select
                id="c-rotation"
                name="rotationMode"
                className={selectClass}
                defaultValue="NONE"
              >
                {ROTATION_MODES.map((r) => (
                  <option key={r} value={r}>
                    {rotationLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-points">Point Value</Label>
              <Input
                id="c-points"
                name="pointValue"
                type="number"
                min="0"
                defaultValue="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-minutes">Est. Minutes</Label>
              <Input
                id="c-minutes"
                name="estimatedMinutes"
                type="number"
                min="1"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-description">Description</Label>
            <Textarea
              id="c-description"
              name="description"
              placeholder="Optional instructions or details"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Assign To</Label>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No household members found.
              </p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {members.map((m) => (
                  <div key={m.membershipId} className="flex items-center gap-2">
                    <Checkbox
                      id={`assignee-${m.membershipId}`}
                      checked={assigneeIds.includes(m.membershipId)}
                      onCheckedChange={(checked) =>
                        toggleAssignee(m.membershipId, checked === true)
                      }
                    />
                    <Label
                      htmlFor={`assignee-${m.membershipId}`}
                      className="font-normal"
                    >
                      {m.displayName}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Chore"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ChoreList({
  chores,
  assignmentsByChore,
  members,
  onToggle,
  onDelete,
  onAddAssignment,
  onRemoveAssignment,
}: {
  chores: Array<ChoreRow>
  assignmentsByChore: Map<string, Array<ChoreAssignmentRow>>
  members: Array<Member>
  onToggle: (id: string) => void
  onDelete: (chore: ChoreRow) => void
  onAddAssignment: (choreId: string, assigneeId: string) => void
  onRemoveAssignment: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      {chores.map((chore) => {
        const choreAssignments = assignmentsByChore.get(chore.id) ?? []
        const assignedIds = new Set(choreAssignments.map((a) => a.assigneeId))
        const availableMembers = members.filter(
          (m) => !assignedIds.has(m.membershipId)
        )

        return (
          <div key={chore.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{chore.title}</h3>
                {chore.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {chore.description}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {frequencyLabel(chore.frequency)}
                  </Badge>
                  {chore.roomName && (
                    <Badge variant="secondary">{chore.roomName}</Badge>
                  )}
                  {chore.pointValue > 0 && (
                    <Badge variant="secondary">{chore.pointValue} pts</Badge>
                  )}
                  {chore.estimatedMinutes && (
                    <Badge variant="secondary">
                      {chore.estimatedMinutes} min
                    </Badge>
                  )}
                  {chore.rotationMode !== "NONE" && (
                    <Badge variant="outline">
                      {rotationLabel(chore.rotationMode)}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={chore.isActive ? "Deactivate" : "Activate"}
                  onClick={() => onToggle(chore.id)}
                >
                  <Power
                    className={`size-3.5 ${chore.isActive ? "text-green-600" : "text-gray-400"}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Delete"
                  onClick={() => onDelete(chore)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Assigned Members
              </div>
              {choreAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {choreAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                    >
                      <span>{a.assigneeName}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30"
                        title="Remove"
                        onClick={() => onRemoveAssignment(a.id)}
                      >
                        <UserMinus className="size-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {availableMembers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {availableMembers.map((m) => (
                    <Button
                      key={m.membershipId}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onAddAssignment(chore.id, m.membershipId)}
                    >
                      <UserPlus className="size-3" />
                      {m.displayName}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DeleteChoreDialog({
  chore,
  onClose,
  onDeleted,
}: {
  chore: ChoreRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteChoreFn({ data: { id: chore.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete chore.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{chore.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This also removes its assignments and completion history.
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
