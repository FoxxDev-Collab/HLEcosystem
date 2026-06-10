import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Pencil, Plus, Trash2 } from "lucide-react"
import {
  createImportantDateFn,
  deleteImportantDateFn,
  getDatesPageFn,
  updateImportantDateFn,
} from "@/server/hub/fns.dates"
import type {
  HubDateEvent,
  ImportantDateType,
  MemberOption,
  RecurrenceType,
} from "@/server/hub/dates"
import { formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

export const Route = createFileRoute("/_authed/hub/dates")({
  loader: () => getDatesPageFn(),
  component: ImportantDatesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const DATE_TYPES: Array<ImportantDateType> = [
  "BIRTHDAY",
  "ANNIVERSARY",
  "GRADUATION",
  "MEMORIAL",
  "HOLIDAY",
  "CUSTOM",
]
const RECURRENCE_TYPES: Array<RecurrenceType> = ["ONCE", "ANNUAL"]

const DATE_TYPE_COLORS: Record<ImportantDateType, string> = {
  BIRTHDAY: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ANNIVERSARY:
    "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  GRADUATION:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  MEMORIAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  HOLIDAY:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  CUSTOM:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
}

function ImportantDatesPage() {
  const { dates, members } = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<HubDateEvent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HubDateEvent | null>(null)

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Important Dates</h1>
          <p className="text-sm text-muted-foreground">
            Birthdays, anniversaries, holidays and one-off events, sorted by
            what&apos;s next.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add date
        </Button>
      </div>

      <div className="space-y-3">
        {dates.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex items-center justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{d.label}</p>
                  <Badge className={DATE_TYPE_COLORS[d.type]}>{d.type}</Badge>
                  {d.recurrenceType === "ANNUAL" && (
                    <Badge variant="outline">Annual</Badge>
                  )}
                  {d.derived && <Badge variant="ghost">From profile</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(d.nextDate)}
                  {d.memberName && ` - ${d.memberName}`}
                </p>
                {d.notes && (
                  <p className="text-xs text-muted-foreground">{d.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Badge
                  variant={
                    d.days === 0
                      ? "destructive"
                      : d.days > 0 && d.days <= 7
                        ? "default"
                        : "secondary"
                  }
                >
                  {d.days === 0
                    ? "Today!"
                    : d.days < 0
                      ? "Passed"
                      : `${d.days} days`}
                </Badge>
                {!d.derived && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      onClick={() => setEditTarget(d)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => setDeleteTarget(d)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {dates.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No important dates yet. Add one to get started — member birthdays
            and anniversaries show up here automatically.
          </p>
        )}
      </div>

      {createOpen && (
        <DateFormDialog
          members={members}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            refresh()
          }}
        />
      )}
      {editTarget && (
        <DateFormDialog
          members={members}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteDateDialog
          date={deleteTarget}
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

function DateFormDialog({
  members,
  initial,
  onClose,
  onSaved,
}: {
  members: Array<MemberOption>
  initial?: HubDateEvent
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
    const payload = {
      label: String(f.get("label") ?? ""),
      date: String(f.get("date") ?? ""),
      type: String(f.get("type") ?? "CUSTOM") as ImportantDateType,
      recurrenceType: String(
        f.get("recurrenceType") ?? "ANNUAL"
      ) as RecurrenceType,
      reminderDaysBefore: String(f.get("reminderDaysBefore") ?? ""),
      familyMemberId: String(f.get("familyMemberId") ?? "") || null,
      notes: String(f.get("notes") ?? "") || null,
    }
    try {
      const result = initial
        ? await updateImportantDateFn({
            data: { ...payload, id: initial.id },
          })
        : await createImportantDateFn({ data: payload })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError(
        initial ? "Could not update the date." : "Could not add the date."
      )
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit important date" : "Add important date"}
          </DialogTitle>
          <DialogDescription>
            Annual dates recur every year; one-time dates don&apos;t.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="d-label">Label *</Label>
              <Input
                id="d-label"
                name="label"
                placeholder="e.g. Mom's Birthday"
                defaultValue={initial?.label ?? ""}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-date">Date *</Label>
              <Input
                id="d-date"
                name="date"
                type="date"
                defaultValue={initial ? toDateInputValue(initial.date) : ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-type">Type *</Label>
              <select
                id="d-type"
                name="type"
                required
                className={selectClass}
                defaultValue={initial?.type ?? "BIRTHDAY"}
              >
                {DATE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-recurrence">Recurrence</Label>
              <select
                id="d-recurrence"
                name="recurrenceType"
                className={selectClass}
                defaultValue={initial?.recurrenceType ?? "ANNUAL"}
              >
                {RECURRENCE_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-reminder">Reminder (days before)</Label>
              <Input
                id="d-reminder"
                name="reminderDaysBefore"
                type="number"
                min={0}
                defaultValue={initial?.reminderDaysBefore ?? 14}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="d-member">Family member (optional)</Label>
              <select
                id="d-member"
                name="familyMemberId"
                className={selectClass}
                defaultValue={initial?.familyMemberId ?? ""}
              >
                <option value="">None</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="d-notes">Notes</Label>
              <Textarea
                id="d-notes"
                name="notes"
                rows={2}
                defaultValue={initial?.notes ?? ""}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : initial ? "Save changes" : "Add date"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDateDialog({
  date,
  onClose,
  onDeleted,
}: {
  date: HubDateEvent
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteImportantDateFn({ data: { id: date.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete the date.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{date.label}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the date from the calendar and upcoming events. This
            cannot be undone.
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
