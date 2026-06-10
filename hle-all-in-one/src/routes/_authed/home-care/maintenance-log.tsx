import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { z } from "zod"
import { ClipboardList, Plus, Trash2 } from "lucide-react"
import {
  createMaintenanceLogFn,
  deleteMaintenanceLogFn,
  getMaintenanceLogPageFn,
} from "@/server/home-care/fns.maintenance-logs"
import type { MaintenanceLogRow } from "@/server/home-care/maintenance-logs"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Item/vehicle filters arrive as search params from detail pages (legacy
// behavior). Anything malformed is dropped.
const searchSchema = z.object({
  itemId: z.string().regex(UUID_RE).optional().catch(undefined),
  vehicleId: z.string().regex(UUID_RE).optional().catch(undefined),
})

export const Route = createFileRoute("/_authed/home-care/maintenance-log")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    itemId: search.itemId ?? null,
    vehicleId: search.vehicleId ?? null,
  }),
  loader: ({ deps }) => getMaintenanceLogPageFn({ data: deps }),
  component: MaintenanceLogPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function formatMileage(miles: number | null): string {
  if (miles === null) return ""
  return `${miles.toLocaleString("en-US")} mi`
}

function logTarget(log: MaintenanceLogRow): string {
  if (log.itemName) return log.itemName
  if (log.vehicleMake) {
    return `${log.vehicleYear ? `${log.vehicleYear} ` : ""}${log.vehicleMake} ${log.vehicleModel ?? ""}`.trim()
  }
  return "—"
}

function numOrNull(value: FormDataEntryValue | null): number | null {
  const v = String(value ?? "").trim()
  return v ? Number(v) : null
}

function MaintenanceLogPage() {
  const { logs, items, vehicles } = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceLogRow | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filtered = Boolean(search.itemId || search.vehicleId)

  function refresh() {
    router.invalidate()
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createMaintenanceLogFn({
        data: {
          title: String(f.get("title") ?? ""),
          description: "",
          itemId: String(f.get("itemId") ?? ""),
          vehicleId: String(f.get("vehicleId") ?? ""),
          completedDate: String(f.get("completedDate") ?? ""),
          completedBy: String(f.get("completedBy") ?? ""),
          cost: numOrNull(f.get("cost")),
          mileageAtService: numOrNull(f.get("mileageAtService")),
          partsUsed: String(f.get("partsUsed") ?? ""),
          notes: String(f.get("notes") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      refresh()
    } catch {
      setError("Could not log maintenance.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Maintenance Log</h1>
          <p className="text-sm text-muted-foreground">
            Your home&apos;s history of completed maintenance.
          </p>
        </div>
        {filtered && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.navigate({
                to: "/home-care/maintenance-log",
                search: {},
              })
            }
          >
            Clear filter
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log Maintenance</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSubmit}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="l-title">What was done?</Label>
              <Input
                id="l-title"
                name="title"
                placeholder="e.g. Replaced HVAC filter"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-item">Item</Label>
              <select
                id="l-item"
                name="itemId"
                className={selectClass}
                defaultValue={search.itemId ?? ""}
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
              <Label htmlFor="l-vehicle">Vehicle</Label>
              <select
                id="l-vehicle"
                name="vehicleId"
                className={selectClass}
                defaultValue={search.vehicleId ?? ""}
              >
                <option value="">Optional</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.year ? `${v.year} ` : ""}
                    {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-date">Completed Date</Label>
              <Input
                id="l-date"
                name="completedDate"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-by">Done By</Label>
              <Input
                id="l-by"
                name="completedBy"
                placeholder="e.g. Self, contractor name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-cost">Cost</Label>
              <Input
                id="l-cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-mileage">Mileage (vehicles)</Label>
              <Input
                id="l-mileage"
                name="mileageAtService"
                type="number"
                min="1"
                placeholder="Odometer"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-parts">Parts Used</Label>
              <Input
                id="l-parts"
                name="partsUsed"
                placeholder="e.g. 20x20x1 filter"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="l-notes">Notes</Label>
              <Input
                id="l-notes"
                name="notes"
                placeholder="Additional details"
              />
            </div>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" />
              {pending ? "Logging…" : "Log"}
            </Button>
            {error && (
              <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No maintenance records yet. Log completed maintenance to build
              your home&apos;s history.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>History ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Item / Vehicle</TableHead>
                  <TableHead>Done By</TableHead>
                  <TableHead>Parts</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.completedDate)}</TableCell>
                    <TableCell className="font-medium">
                      {log.title}
                      {log.notes && (
                        <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                          {log.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {logTarget(log)}
                      {log.mileageAtService
                        ? ` (${formatMileage(log.mileageAtService)})`
                        : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.completedBy || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.partsUsed || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.cost ? formatCurrency(log.cost) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Delete"
                        onClick={() => setDeleteTarget(log)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
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
        <DeleteLogDialog
          log={deleteTarget}
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

function DeleteLogDialog({
  log,
  onClose,
  onDeleted,
}: {
  log: MaintenanceLogRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteMaintenanceLogFn({ data: { id: log.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete log entry.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{log.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This maintenance record is permanently removed.
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
