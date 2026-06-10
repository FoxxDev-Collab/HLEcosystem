import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Pause, Pill, Play, Plus, RefreshCw, Trash2 } from "lucide-react"
import {
  createMedicationFn,
  deleteMedicationFn,
  getMedicationsPageFn,
  recordRefillFn,
  toggleMedicationActiveFn,
} from "@/server/health/fns.medications"
import type {
  HealthMemberOption,
  MedicationRow,
} from "@/server/health/medications"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
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

export const Route = createFileRoute("/_authed/health/medications")({
  loader: () => getMedicationsPageFn(),
  component: MedicationsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function datePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateInputValue(d)
}

function MedicationsPage() {
  const { members, medications } = Route.useLoaderData()
  const router = useRouter()
  const [memberFilter, setMemberFilter] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<MedicationRow | null>(null)

  const filtered = memberFilter
    ? medications.filter((m) => m.memberId === memberFilter)
    : medications
  const active = filtered.filter((m) => m.isActive)
  const inactive = filtered.filter((m) => !m.isActive)

  // Legacy rule: refills "due soon" are active meds whose nextRefillDate is
  // within the next 7 days (including past-due).
  const sevenDays = datePlusDays(7)
  const refillsDue = active.filter(
    (m) => m.nextRefillDate && m.nextRefillDate <= sevenDays
  )

  function refresh() {
    router.invalidate()
  }

  async function onRefill(id: string) {
    await recordRefillFn({ data: { id } })
    refresh()
  }

  async function onToggle(id: string) {
    await toggleMedicationActiveFn({ data: { id } })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Medications</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        {members.length > 0 && (
          <select
            className={`${selectClass} w-48`}
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            aria-label="Filter by family member"
          >
            <option value="">All members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
        )}
      </div>

      <AddMedicationCard members={members} onSaved={refresh} />

      {refillsDue.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-base text-orange-700 dark:text-orange-400">
              Refills Due Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {refillsDue.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm">
                    {med.medicationName} — {med.memberFirstName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(med.nextRefillDate)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRefill(med.id)}
                    >
                      <RefreshCw className="size-3" /> Refilled
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Active ({active.length})</h2>
          {active.map((med) => (
            <Card key={med.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{med.medicationName}</span>
                      <Badge variant="outline" className="text-xs">
                        {med.memberFirstName}
                      </Badge>
                      {med.paidFromHsa && (
                        <Badge variant="secondary" className="text-xs">
                          HSA
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {med.dosage && med.dosage}
                      {med.frequency && ` · ${med.frequency}`}
                      {med.prescribedBy && ` · Dr. ${med.prescribedBy}`}
                      {med.pharmacy && ` · ${med.pharmacy}`}
                    </div>
                    {(med.nextRefillDate || med.refillsRemaining !== null) && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {med.nextRefillDate &&
                          `Next refill: ${formatDate(med.nextRefillDate)}`}
                        {med.refillsRemaining !== null &&
                          ` · ${med.refillsRemaining} refills left`}
                        {med.costPerRefill !== null &&
                          ` · ${formatCurrency(med.costPerRefill)}/refill`}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Record refill"
                      onClick={() => onRefill(med.id)}
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Deactivate"
                      onClick={() => onToggle(med.id)}
                    >
                      <Pause className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => setDeleteTarget(med)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Inactive ({inactive.length})
          </h2>
          {inactive.map((med) => (
            <Card key={med.id} className="opacity-50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">
                      {med.medicationName}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {med.memberFirstName}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Reactivate"
                    onClick={() => onToggle(med.id)}
                  >
                    <Play className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Pill className="mx-auto mb-3 size-10 opacity-40" />
            <p>No medications yet. Add one above to start tracking refills.</p>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteMedicationDialog
          medication={deleteTarget}
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

function AddMedicationCard({
  members,
  onSaved,
}: {
  members: Array<HealthMemberOption>
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createMedicationFn({
        data: {
          memberId: String(f.get("memberId") ?? ""),
          medicationName: String(f.get("medicationName") ?? ""),
          dosage: String(f.get("dosage") ?? ""),
          frequency: String(f.get("frequency") ?? ""),
          prescribedBy: String(f.get("prescribedBy") ?? ""),
          pharmacy: String(f.get("pharmacy") ?? ""),
          purpose: String(f.get("purpose") ?? ""),
          startDate: String(f.get("startDate") ?? ""),
          nextRefillDate: String(f.get("nextRefillDate") ?? ""),
          refillsRemaining: f.get("refillsRemaining")
            ? Number(f.get("refillsRemaining"))
            : null,
          costPerRefill: f.get("costPerRefill")
            ? Number(f.get("costPerRefill"))
            : null,
          paidFromHsa: f.get("paidFromHsa") === "on",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setPending(false)
      onSaved()
    } catch {
      setError("Could not add medication.")
      setPending(false)
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Enable health tracking for a family member first to add medications.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Medication</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="med-member">Family Member</Label>
            <select
              id="med-member"
              name="memberId"
              className={selectClass}
              defaultValue={members[0]?.id}
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-name">Medication Name</Label>
            <Input id="med-name" name="medicationName" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-dosage">Dosage</Label>
            <Input id="med-dosage" name="dosage" placeholder="e.g. 10mg" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-frequency">Frequency</Label>
            <Input
              id="med-frequency"
              name="frequency"
              placeholder="e.g. Once daily"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-prescribedBy">Prescribed By</Label>
            <Input id="med-prescribedBy" name="prescribedBy" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-pharmacy">Pharmacy</Label>
            <Input id="med-pharmacy" name="pharmacy" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-purpose">Purpose</Label>
            <Input id="med-purpose" name="purpose" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-startDate">Start Date</Label>
            <Input id="med-startDate" name="startDate" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-nextRefillDate">Next Refill Date</Label>
            <Input id="med-nextRefillDate" name="nextRefillDate" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-refillsRemaining">Refills Remaining</Label>
            <Input
              id="med-refillsRemaining"
              name="refillsRemaining"
              type="number"
              min="0"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="med-costPerRefill">Cost/Refill</Label>
            <Input
              id="med-costPerRefill"
              name="costPerRefill"
              type="number"
              step="0.01"
              min="0"
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              name="paidFromHsa"
              id="med-paidFromHsa"
              className="size-4 accent-primary"
            />
            <Label htmlFor="med-paidFromHsa" className="text-sm">
              Paid from HSA
            </Label>
          </div>
          <Button type="submit" disabled={pending} className="lg:col-span-4">
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Medication"}
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

function DeleteMedicationDialog({
  medication,
  onClose,
  onDeleted,
}: {
  medication: MedicationRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteMedicationFn({
        data: { id: medication.id },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete medication.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {medication.medicationName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This medication and its refill history will be permanently removed.
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
