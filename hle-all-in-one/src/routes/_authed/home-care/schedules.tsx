import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import {
  completeScheduleFn,
  createScheduleFn,
  deleteScheduleFn,
  getSchedulesPageFn,
  updateScheduleFn,
} from "@/server/home-care/fns.schedules"
import type {
  ItemOption,
  MaintenanceFrequency,
  ScheduleRow,
  VehicleOption,
} from "@/server/home-care/schedules"
import { formatDate, toDateInputValue } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/home-care/schedules")({
  loader: () => getSchedulesPageFn(),
  component: SchedulesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const FREQUENCIES: Array<MaintenanceFrequency> = [
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUALLY",
  "ANNUALLY",
  "CUSTOM_DAYS",
]

function formatFrequency(
  frequency: string,
  customDays?: number | null
): string {
  switch (frequency) {
    case "WEEKLY":
      return "Weekly"
    case "BI_WEEKLY":
      return "Every 2 weeks"
    case "MONTHLY":
      return "Monthly"
    case "QUARTERLY":
      return "Every 3 months"
    case "SEMI_ANNUALLY":
      return "Every 6 months"
    case "ANNUALLY":
      return "Annually"
    case "CUSTOM_DAYS":
      return customDays ? `Every ${customDays} days` : "Custom"
    default:
      return frequency
  }
}

function vehicleLabel(v: {
  year?: number | null
  vehicleYear?: number | null
  make?: string | null
  vehicleMake?: string | null
  model?: string | null
  vehicleModel?: string | null
}): string {
  const year = v.year ?? v.vehicleYear
  const make = v.make ?? v.vehicleMake
  const model = v.model ?? v.vehicleModel
  return `${year ? `${year} ` : ""}${make ?? ""} ${model ?? ""}`.trim()
}

function scheduleTarget(s: ScheduleRow): string {
  if (s.itemName) return s.itemName
  if (s.vehicleMake) return vehicleLabel(s)
  return "—"
}

function numOrNull(value: FormDataEntryValue | null): number | null {
  const v = String(value ?? "").trim()
  return v ? Number(v) : null
}

function SchedulesPage() {
  const { schedules, items, vehicles } = Route.useLoaderData()
  const router = useRouter()
  const [completeTarget, setCompleteTarget] = useState<ScheduleRow | null>(null)
  const [editTarget, setEditTarget] = useState<ScheduleRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleRow | null>(null)

  const today = toDateInputValue(new Date())
  const active = schedules.filter((s) => s.isActive)
  const overdue = active.filter((s) => s.nextDueDate && s.nextDueDate < today)
  const upcoming = active.filter(
    (s) => !s.nextDueDate || s.nextDueDate >= today
  )
  const inactive = schedules.filter((s) => !s.isActive)

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Maintenance Schedules</h1>
        <p className="text-sm text-muted-foreground">
          Recurring home and vehicle care tasks.
        </p>
      </div>

      {overdue.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              <span>
                <strong>{overdue.length}</strong> overdue task
                {overdue.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <CreateScheduleCard items={items} vehicles={vehicles} onSaved={refresh} />

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarClock className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No maintenance schedules yet. Create recurring tasks to stay on
              top of home &amp; vehicle care.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {overdue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">
                  Overdue ({overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ScheduleTable
                  schedules={overdue}
                  today={today}
                  isOverdue
                  onComplete={setCompleteTarget}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              </CardContent>
            </Card>
          )}

          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Schedules ({upcoming.length})</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ScheduleTable
                  schedules={upcoming}
                  today={today}
                  onComplete={setCompleteTarget}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              </CardContent>
            </Card>
          )}

          {inactive.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  Inactive ({inactive.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 opacity-60">
                <ScheduleTable
                  schedules={inactive}
                  today={today}
                  onComplete={setCompleteTarget}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {completeTarget && (
        <CompleteScheduleDialog
          schedule={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onSaved={() => {
            setCompleteTarget(null)
            refresh()
          }}
        />
      )}
      {editTarget && (
        <EditScheduleDialog
          schedule={editTarget}
          items={items}
          vehicles={vehicles}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteScheduleDialog
          schedule={deleteTarget}
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

function ScheduleTable({
  schedules,
  today,
  isOverdue = false,
  onComplete,
  onEdit,
  onDelete,
}: {
  schedules: Array<ScheduleRow>
  today: string
  isOverdue?: boolean
  onComplete: (s: ScheduleRow) => void
  onEdit: (s: ScheduleRow) => void
  onDelete: (s: ScheduleRow) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>For</TableHead>
          <TableHead>Frequency</TableHead>
          <TableHead>Next Due</TableHead>
          <TableHead>Last Done</TableHead>
          <TableHead>Assigned</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((s) => (
          <TableRow key={s.id}>
            <TableCell
              className={`font-medium ${isOverdue ? "text-destructive" : ""}`}
            >
              {s.title}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {scheduleTarget(s)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatFrequency(s.frequency, s.customIntervalDays)}
            </TableCell>
            <TableCell>
              {s.nextDueDate ? (
                <span
                  className={
                    s.nextDueDate < today ? "font-medium text-destructive" : ""
                  }
                >
                  {formatDate(s.nextDueDate)}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {s.lastCompletedDate ? formatDate(s.lastCompletedDate) : "Never"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {s.assignedTo || "—"}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Mark Complete"
                  onClick={() => onComplete(s)}
                >
                  <CheckCircle2 className="size-3.5 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Edit"
                  onClick={() => onEdit(s)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Delete"
                  onClick={() => onDelete(s)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ScheduleFormFields({
  schedule,
  items,
  vehicles,
}: {
  schedule?: ScheduleRow
  items: Array<ItemOption>
  vehicles: Array<VehicleOption>
}) {
  const [frequency, setFrequency] = useState<string>(
    schedule?.frequency ?? "MONTHLY"
  )
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="s-title">Task Title</Label>
        <Input
          id="s-title"
          name="title"
          placeholder="e.g. Replace HVAC filter"
          defaultValue={schedule?.title}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="s-item">For Item</Label>
        <select
          id="s-item"
          name="itemId"
          className={selectClass}
          defaultValue={schedule?.itemId ?? ""}
        >
          <option value="">Optional</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="s-vehicle">For Vehicle</Label>
        <select
          id="s-vehicle"
          name="vehicleId"
          className={selectClass}
          defaultValue={schedule?.vehicleId ?? ""}
        >
          <option value="">Optional</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {vehicleLabel(v)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="s-frequency">Frequency</Label>
        <select
          id="s-frequency"
          name="frequency"
          className={selectClass}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      {frequency === "CUSTOM_DAYS" && (
        <div className="space-y-1">
          <Label htmlFor="s-custom">Interval (days)</Label>
          <Input
            id="s-custom"
            name="customIntervalDays"
            type="number"
            min="1"
            placeholder="30"
            defaultValue={schedule?.customIntervalDays ?? ""}
          />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="s-due">Next Due Date</Label>
        <Input
          id="s-due"
          name="nextDueDate"
          type="date"
          defaultValue={schedule?.nextDueDate ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="s-cost">Est. Cost</Label>
        <Input
          id="s-cost"
          name="estimatedCost"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          defaultValue={schedule?.estimatedCost ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="s-assigned">Assigned To</Label>
        <Input
          id="s-assigned"
          name="assignedTo"
          placeholder="Who handles this?"
          defaultValue={schedule?.assignedTo ?? ""}
        />
      </div>
    </>
  )
}

function readScheduleForm(f: FormData) {
  return {
    title: String(f.get("title") ?? ""),
    description: "",
    itemId: String(f.get("itemId") ?? ""),
    vehicleId: String(f.get("vehicleId") ?? ""),
    frequency: String(f.get("frequency") ?? "MONTHLY") as MaintenanceFrequency,
    customIntervalDays: numOrNull(f.get("customIntervalDays")),
    nextDueDate: String(f.get("nextDueDate") ?? ""),
    estimatedCost: numOrNull(f.get("estimatedCost")),
    assignedTo: String(f.get("assignedTo") ?? ""),
  }
}

function CreateScheduleCard({
  items,
  vehicles,
  onSaved,
}: {
  items: Array<ItemOption>
  vehicles: Array<VehicleOption>
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    try {
      const result = await createScheduleFn({
        data: readScheduleForm(new FormData(form)),
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      onSaved()
    } catch {
      setError("Could not create schedule.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <ScheduleFormFields items={items} vehicles={vehicles} />
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Creating…" : "Create"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function CompleteScheduleDialog({
  schedule,
  onClose,
  onSaved,
}: {
  schedule: ScheduleRow
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
      const result = await completeScheduleFn({
        data: {
          scheduleId: schedule.id,
          completedDate: String(
            f.get("completedDate") ?? toDateInputValue(new Date())
          ),
          completedBy: String(f.get("completedBy") ?? ""),
          cost: numOrNull(f.get("cost")),
          mileageAtService: numOrNull(f.get("mileageAtService")),
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
      setError("Could not complete schedule.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete “{schedule.title}”</DialogTitle>
          <DialogDescription>
            Logs a maintenance record and advances the next due date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="c-date">Completed Date</Label>
              <Input
                id="c-date"
                name="completedDate"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-by">Done By</Label>
              <Input
                id="c-by"
                name="completedBy"
                placeholder="Self, contractor…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-cost">Cost</Label>
              <Input
                id="c-cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            {schedule.vehicleId && (
              <div className="space-y-1">
                <Label htmlFor="c-mileage">Mileage at Service</Label>
                <Input
                  id="c-mileage"
                  name="mileageAtService"
                  type="number"
                  min="1"
                  placeholder="Odometer"
                />
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="c-notes">Notes</Label>
              <Input id="c-notes" name="notes" placeholder="Optional" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Completing…" : "Mark Complete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditScheduleDialog({
  schedule,
  items,
  vehicles,
  onClose,
  onSaved,
}: {
  schedule: ScheduleRow
  items: Array<ItemOption>
  vehicles: Array<VehicleOption>
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
      const result = await updateScheduleFn({
        data: {
          ...readScheduleForm(f),
          description: schedule.description ?? "",
          id: schedule.id,
          isActive: f.get("isActive") !== null,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not update schedule.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ScheduleFormFields
              schedule={schedule}
              items={items}
              vehicles={vehicles}
            />
            <div className="flex items-center gap-2 pt-5">
              <input
                id="s-active"
                name="isActive"
                type="checkbox"
                defaultChecked={schedule.isActive}
                className="size-4"
              />
              <Label htmlFor="s-active">Active</Label>
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

function DeleteScheduleDialog({
  schedule,
  onClose,
  onDeleted,
}: {
  schedule: ScheduleRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteScheduleFn({ data: { id: schedule.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete schedule.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{schedule.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The schedule is removed. Past maintenance log entries are kept.
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
