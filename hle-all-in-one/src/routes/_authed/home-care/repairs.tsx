import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { CheckCircle2, Pencil, Plus, Trash2, Wrench } from "lucide-react"
import {
  createRepairFn,
  deleteRepairFn,
  getRepairsPageFn,
  updateRepairFn,
  updateRepairStatusFn,
} from "@/server/home-care/fns.repairs"
import type {
  ProviderOption,
  RepairRow,
  RepairStatus,
} from "@/server/home-care/repairs"
import type { ItemOption, VehicleOption } from "@/server/home-care/schedules"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
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

export const Route = createFileRoute("/_authed/home-care/repairs")({
  loader: () => getRepairsPageFn(),
  component: RepairsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const STATUSES: Array<RepairStatus> = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]

const STATUS_VARIANTS: Record<
  RepairStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  SCHEDULED: "outline",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  CANCELLED: "secondary",
}

function repairTarget(r: RepairRow): string {
  if (r.itemName) return r.itemName
  if (r.vehicleMake) {
    return `${r.vehicleYear ? `${r.vehicleYear} ` : ""}${r.vehicleMake} ${r.vehicleModel ?? ""}`.trim()
  }
  return "—"
}

function numOrNull(value: FormDataEntryValue | null): number | null {
  const v = String(value ?? "").trim()
  return v ? Number(v) : null
}

function RepairsPage() {
  const { repairs, items, vehicles, providers } = Route.useLoaderData()
  const router = useRouter()
  const [editTarget, setEditTarget] = useState<RepairRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RepairRow | null>(null)

  const active = repairs.filter(
    (r) => r.status === "SCHEDULED" || r.status === "IN_PROGRESS"
  )
  const completed = repairs.filter(
    (r) => r.status === "COMPLETED" || r.status === "CANCELLED"
  )
  const totalRepairCost = repairs
    .filter((r) => r.status === "COMPLETED" && r.totalCost)
    .reduce((sum, r) => sum + (r.totalCost ?? 0), 0)

  function refresh() {
    router.invalidate()
  }

  async function markComplete(repair: RepairRow) {
    await updateRepairStatusFn({
      data: { id: repair.id, status: "COMPLETED" },
    })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Repairs</h1>
          <p className="text-sm text-muted-foreground">
            Track issues from report to fix.
          </p>
        </div>
        {totalRepairCost > 0 && (
          <div className="text-sm text-muted-foreground">
            Total spent:{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(totalRepairCost)}
            </span>
          </div>
        )}
      </div>

      <ReportRepairCard
        items={items}
        vehicles={vehicles}
        providers={providers}
        onSaved={refresh}
      />

      {repairs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No repairs recorded. Report issues when things break to build your
              repair history.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Repairs ({active.length})</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead>Item / Vehicle</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Reported</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {repairTarget(r)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.providerName || "—"}
                        </TableCell>
                        <TableCell>{formatDate(r.reportedDate)}</TableCell>
                        <TableCell>
                          {r.scheduledDate ? formatDate(r.scheduledDate) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[r.status]}>
                            {r.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Mark Complete"
                              onClick={() => markComplete(r)}
                            >
                              <CheckCircle2 className="size-3.5 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Edit"
                              onClick={() => setEditTarget(r)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Delete"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {completed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  Completed ({completed.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead>Item / Vehicle</TableHead>
                      <TableHead>Done By</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completed.map((r) => (
                      <TableRow key={r.id} className="opacity-70">
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {repairTarget(r)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.completedBy || r.providerName || "—"}
                        </TableCell>
                        <TableCell>
                          {formatDate(r.completedDate || r.reportedDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.totalCost ? formatCurrency(r.totalCost) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[r.status]}>
                            {r.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Edit"
                              onClick={() => setEditTarget(r)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Delete"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {editTarget && (
        <EditRepairDialog
          repair={editTarget}
          items={items}
          vehicles={vehicles}
          providers={providers}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
      {deleteTarget && (
        <DeleteRepairDialog
          repair={deleteTarget}
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

function RepairFormFields({
  repair,
  items,
  vehicles,
  providers,
}: {
  repair?: RepairRow
  items: Array<ItemOption>
  vehicles: Array<VehicleOption>
  providers: Array<ProviderOption>
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="r-title">What needs repair?</Label>
        <Input
          id="r-title"
          name="title"
          placeholder="e.g. Dishwasher not draining"
          defaultValue={repair?.title}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-item">Item</Label>
        <select
          id="r-item"
          name="itemId"
          className={selectClass}
          defaultValue={repair?.itemId ?? ""}
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
        <Label htmlFor="r-vehicle">Vehicle</Label>
        <select
          id="r-vehicle"
          name="vehicleId"
          className={selectClass}
          defaultValue={repair?.vehicleId ?? ""}
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
        <Label htmlFor="r-provider">Service Provider</Label>
        <select
          id="r-provider"
          name="providerId"
          className={selectClass}
          defaultValue={repair?.providerId ?? ""}
        >
          <option value="">Optional</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.company ? ` (${p.company})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-reported">Reported Date</Label>
        <Input
          id="r-reported"
          name="reportedDate"
          type="date"
          defaultValue={repair?.reportedDate ?? toDateInputValue(new Date())}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-scheduled">Scheduled Date</Label>
        <Input
          id="r-scheduled"
          name="scheduledDate"
          type="date"
          defaultValue={repair?.scheduledDate ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-labor">Labor Cost</Label>
        <Input
          id="r-labor"
          name="laborCost"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          defaultValue={repair?.laborCost ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-parts-cost">Parts Cost</Label>
        <Input
          id="r-parts-cost"
          name="partsCost"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          defaultValue={repair?.partsCost ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-by">Done By</Label>
        <Input
          id="r-by"
          name="completedBy"
          placeholder="Self, contractor…"
          defaultValue={repair?.completedBy ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-parts">Parts Used</Label>
        <Input
          id="r-parts"
          name="partsUsed"
          placeholder="List parts"
          defaultValue={repair?.partsUsed ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-notes">Notes</Label>
        <Input
          id="r-notes"
          name="notes"
          placeholder="Details"
          defaultValue={repair?.notes ?? ""}
        />
      </div>
    </>
  )
}

function readRepairForm(f: FormData, repair?: RepairRow) {
  return {
    title: String(f.get("title") ?? ""),
    description: repair?.description ?? "",
    itemId: String(f.get("itemId") ?? ""),
    vehicleId: String(f.get("vehicleId") ?? ""),
    providerId: String(f.get("providerId") ?? ""),
    reportedDate: String(f.get("reportedDate") ?? ""),
    scheduledDate: String(f.get("scheduledDate") ?? ""),
    completedBy: String(f.get("completedBy") ?? ""),
    laborCost: numOrNull(f.get("laborCost")),
    partsCost: numOrNull(f.get("partsCost")),
    warrantyClaimId: repair?.warrantyClaimId ?? "",
    partsUsed: String(f.get("partsUsed") ?? ""),
    notes: String(f.get("notes") ?? ""),
  }
}

function ReportRepairCard({
  items,
  vehicles,
  providers,
  onSaved,
}: {
  items: Array<ItemOption>
  vehicles: Array<VehicleOption>
  providers: Array<ProviderOption>
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
      const result = await createRepairFn({
        data: readRepairForm(new FormData(form)),
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      onSaved()
    } catch {
      setError("Could not report repair.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Repair</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <RepairFormFields
            items={items}
            vehicles={vehicles}
            providers={providers}
          />
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Reporting…" : "Report"}
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

function EditRepairDialog({
  repair,
  items,
  vehicles,
  providers,
  onClose,
  onSaved,
}: {
  repair: RepairRow
  items: Array<ItemOption>
  vehicles: Array<VehicleOption>
  providers: Array<ProviderOption>
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
      const result = await updateRepairFn({
        data: {
          ...readRepairForm(f, repair),
          id: repair.id,
          status: String(f.get("status") ?? "SCHEDULED") as RepairStatus,
          completedDate: String(f.get("completedDate") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not update repair.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Repair</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <RepairFormFields
              repair={repair}
              items={items}
              vehicles={vehicles}
              providers={providers}
            />
            <div className="space-y-1">
              <Label htmlFor="r-status">Status</Label>
              <select
                id="r-status"
                name="status"
                className={selectClass}
                defaultValue={repair.status}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-completed">Completed Date</Label>
              <Input
                id="r-completed"
                name="completedDate"
                type="date"
                defaultValue={repair.completedDate ?? ""}
              />
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

function DeleteRepairDialog({
  repair,
  onClose,
  onDeleted,
}: {
  repair: RepairRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteRepairFn({ data: { id: repair.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete repair.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{repair.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This repair record is permanently removed.
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
