import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Plus, Syringe, Trash2 } from "lucide-react"
import {
  createVaccinationFn,
  deleteVaccinationFn,
  getVaccinationsPageFn,
} from "@/server/health/fns.vaccinations"
import type { HealthMemberOption } from "@/server/health/medications"
import type { VaccinationRow } from "@/server/health/vaccinations"
import { formatDate, toDateInputValue } from "@/lib/format"
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

export const Route = createFileRoute("/_authed/health/vaccinations")({
  loader: () => getVaccinationsPageFn(),
  component: VaccinationsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function datePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateInputValue(d)
}

function VaccinationsPage() {
  const { members, vaccinations } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<VaccinationRow | null>(null)

  // Legacy rule: "upcoming doses" are next-dose dates within the next 30 days.
  const today = toDateInputValue(new Date())
  const thirtyDays = datePlusDays(30)
  const upcoming = vaccinations.filter(
    (v) =>
      v.nextDoseDate && v.nextDoseDate >= today && v.nextDoseDate <= thirtyDays
  )

  // Group by member (legacy grouping).
  const byMember = new Map<string, Array<VaccinationRow>>()
  for (const vax of vaccinations) {
    const name = `${vax.memberFirstName} ${vax.memberLastName}`
    const existing = byMember.get(name) ?? []
    existing.push(vax)
    byMember.set(name, existing)
  }

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Vaccinations</h1>
        <p className="text-sm text-muted-foreground">
          Immunization records and upcoming doses for the household.
        </p>
      </div>

      <AddVaccinationCard members={members} onSaved={refresh} />

      {upcoming.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-base text-blue-700 dark:text-blue-400">
              Upcoming Doses (Next 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((vax) => (
                <div key={vax.id} className="flex justify-between text-sm">
                  <span>
                    {vax.vaccineName} — {vax.memberFirstName}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(vax.nextDoseDate)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {Array.from(byMember.entries()).map(([name, vaxes]) => (
        <Card key={name}>
          <CardHeader>
            <CardTitle className="text-base">
              {name} ({vaxes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {vaxes.map((vax) => (
                <div
                  key={vax.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {vax.vaccineName}
                      </span>
                      {vax.doseNumber && (
                        <Badge variant="outline" className="text-xs">
                          {vax.doseNumber}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(vax.dateAdministered)}
                      {vax.administeredBy && ` · ${vax.administeredBy}`}
                      {vax.lotNumber && ` · Lot: ${vax.lotNumber}`}
                      {vax.nextDoseDate &&
                        ` · Next: ${formatDate(vax.nextDoseDate)}`}
                    </div>
                    {vax.notes && (
                      <p className="mt-0.5 text-xs text-muted-foreground italic">
                        {vax.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Delete"
                    onClick={() => setDeleteTarget(vax)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {vaccinations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Syringe className="mx-auto mb-3 size-10 opacity-40" />
            <p>No vaccinations recorded yet.</p>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteVaccinationDialog
          vaccination={deleteTarget}
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

function AddVaccinationCard({
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
      const result = await createVaccinationFn({
        data: {
          memberId: String(f.get("memberId") ?? ""),
          vaccineName: String(f.get("vaccineName") ?? ""),
          doseNumber: String(f.get("doseNumber") ?? ""),
          dateAdministered: String(f.get("dateAdministered") ?? ""),
          nextDoseDate: String(f.get("nextDoseDate") ?? ""),
          administeredBy: String(f.get("administeredBy") ?? ""),
          lotNumber: String(f.get("lotNumber") ?? ""),
          notes: String(f.get("notes") ?? ""),
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
      setError("Could not record vaccination.")
      setPending(false)
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Enable health tracking for a family member first to record
          vaccinations.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record Vaccination</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="vax-member">Family Member</Label>
            <select
              id="vax-member"
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
            <Label htmlFor="vax-name">Vaccine Name</Label>
            <Input
              id="vax-name"
              name="vaccineName"
              placeholder="e.g. COVID-19, Flu"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vax-dose">Dose #</Label>
            <Input
              id="vax-dose"
              name="doseNumber"
              placeholder="e.g. 1st, 2nd, Booster"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vax-date">Date Administered</Label>
            <Input
              id="vax-date"
              name="dateAdministered"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vax-nextDose">Next Dose Date</Label>
            <Input id="vax-nextDose" name="nextDoseDate" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vax-administeredBy">Administered By</Label>
            <Input id="vax-administeredBy" name="administeredBy" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vax-lot">Lot Number</Label>
            <Input id="vax-lot" name="lotNumber" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vax-notes">Notes</Label>
            <Input id="vax-notes" name="notes" />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Recording…" : "Record"}
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

function DeleteVaccinationDialog({
  vaccination,
  onClose,
  onDeleted,
}: {
  vaccination: VaccinationRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteVaccinationFn({
        data: { id: vaccination.id },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete vaccination.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {vaccination.vaccineName} record?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This vaccination record will be permanently removed.
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
