import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Plus, Trash2 } from "lucide-react"
import {
  createVisitSummaryFn,
  deleteVisitSummaryFn,
  getHealthVisitsPageFn,
} from "@/server/health/fns.visits"
import type {
  LinkableAppointmentRow,
  VisitSummaryRow,
  VisitType,
} from "@/server/health/visits"
import type { MemberOption } from "@/server/health/members"
import type { ProviderOption } from "@/server/health/providers"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/health/visits")({
  loader: () => getHealthVisitsPageFn(),
  component: VisitsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const VISIT_TYPES: Array<VisitType> = [
  "IN_PERSON",
  "TELEHEALTH",
  "EMERGENCY",
  "HOSPITAL",
  "URGENT_CARE",
]

function VisitsPage() {
  const { members, providers, visits, linkableAppointments } =
    Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<VisitSummaryRow | null>(null)

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Visit Summaries</h1>
        <p className="text-sm text-muted-foreground">
          Record what happened at each medical visit — diagnosis, treatment,
          follow-up and costs.
        </p>
      </div>

      <RecordVisitCard
        members={members}
        providers={providers}
        linkableAppointments={linkableAppointments}
        onSaved={refresh}
      />

      {visits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No visit summaries yet. Record one above after an appointment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => (
            <Card key={visit.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {visit.memberFirstName} {visit.memberLastName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {visit.visitType.replace(/_/g, " ")}
                      </Badge>
                      {visit.paidFromHsa && (
                        <Badge variant="secondary" className="text-xs">
                          HSA
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(visit.visitDate)}
                      {visit.providerName && ` · ${visit.providerName}`}
                      {visit.chiefComplaint && ` · ${visit.chiefComplaint}`}
                    </div>
                    {visit.diagnosis && (
                      <div className="mt-1 text-xs">Dx: {visit.diagnosis}</div>
                    )}
                    {visit.treatmentProvided && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Tx: {visit.treatmentProvided}
                      </div>
                    )}
                    {visit.followUpInstructions && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Follow-up: {visit.followUpInstructions}
                      </div>
                    )}
                    {(visit.billedAmount !== null ||
                      visit.outOfPocketCost !== null) && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {visit.billedAmount !== null &&
                          `Billed: ${formatCurrency(visit.billedAmount)}`}
                        {visit.insurancePaid !== null &&
                          ` · Ins: ${formatCurrency(visit.insurancePaid)}`}
                        {visit.outOfPocketCost !== null &&
                          ` · OOP: ${formatCurrency(visit.outOfPocketCost)}`}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Delete"
                    onClick={() => setDeleteTarget(visit)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteVisitDialog
          visit={deleteTarget}
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

function RecordVisitCard({
  members,
  providers,
  linkableAppointments,
  onSaved,
}: {
  members: Array<MemberOption>
  providers: Array<ProviderOption>
  linkableAppointments: Array<LinkableAppointmentRow>
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? "")

  // A visit summary links 1:1 to an appointment, so only the selected
  // member's unlinked appointments are offered.
  const memberAppointments = linkableAppointments.filter(
    (a) => a.memberId === selectedMemberId
  )

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const money = (key: string): number | null => {
      const v = String(f.get(key) ?? "").trim()
      if (!v) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    try {
      const result = await createVisitSummaryFn({
        data: {
          memberId: String(f.get("memberId") ?? ""),
          providerId: String(f.get("providerId") ?? ""),
          appointmentId: String(f.get("appointmentId") ?? ""),
          visitDate: String(f.get("visitDate") ?? ""),
          visitType: String(f.get("visitType") ?? "IN_PERSON") as VisitType,
          chiefComplaint: String(f.get("chiefComplaint") ?? ""),
          diagnosis: String(f.get("diagnosis") ?? ""),
          treatmentProvided: String(f.get("treatmentProvided") ?? ""),
          prescriptionsWritten: String(f.get("prescriptionsWritten") ?? ""),
          labTestsOrdered: String(f.get("labTestsOrdered") ?? ""),
          followUpInstructions: String(f.get("followUpInstructions") ?? ""),
          notes: String(f.get("notes") ?? ""),
          billedAmount: money("billedAmount"),
          insurancePaid: money("insurancePaid"),
          outOfPocketCost: money("outOfPocketCost"),
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
      setError("Could not record the visit.")
      setPending(false)
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Enable health tracking for a family member first to record visits.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record Visit</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="visit-member">Family Member</Label>
              <select
                id="visit-member"
                name="memberId"
                className={selectClass}
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
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
              <Label htmlFor="visit-provider">Provider</Label>
              <select
                id="visit-provider"
                name="providerId"
                className={selectClass}
                defaultValue=""
              >
                <option value="">Optional</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="visit-date">Visit Date</Label>
              <Input
                id="visit-date"
                name="visitDate"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visit-type">Visit Type</Label>
              <select
                id="visit-type"
                name="visitType"
                className={selectClass}
                defaultValue="IN_PERSON"
              >
                {VISIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {memberAppointments.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="visit-appointment">
                Link to Appointment (optional)
              </Label>
              <select
                id="visit-appointment"
                name="appointmentId"
                className={selectClass}
                defaultValue=""
              >
                <option value="">No linked appointment</option>
                {memberAppointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatDate(a.appointmentDateTime)} —{" "}
                    {a.appointmentType.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="visit-complaint">Chief Complaint</Label>
              <Input id="visit-complaint" name="chiefComplaint" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visit-diagnosis">Diagnosis</Label>
              <Input id="visit-diagnosis" name="diagnosis" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="visit-treatment">Treatment Provided</Label>
              <Textarea
                id="visit-treatment"
                name="treatmentProvided"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visit-followUp">Follow-Up Instructions</Label>
              <Textarea
                id="visit-followUp"
                name="followUpInstructions"
                rows={2}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="visit-prescriptions">Prescriptions Written</Label>
              <Input id="visit-prescriptions" name="prescriptionsWritten" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visit-labs">Lab Tests Ordered</Label>
              <Input id="visit-labs" name="labTestsOrdered" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visit-notes">Notes</Label>
              <Input id="visit-notes" name="notes" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="visit-billed">Billed Amount</Label>
              <Input
                id="visit-billed"
                name="billedAmount"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visit-insurance">Insurance Paid</Label>
              <Input
                id="visit-insurance"
                name="insurancePaid"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visit-oop">Out of Pocket</Label>
              <Input
                id="visit-oop"
                name="outOfPocketCost"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                name="paidFromHsa"
                id="visit-paidFromHsa"
                className="size-4 accent-primary"
              />
              <Label htmlFor="visit-paidFromHsa">Paid from HSA</Label>
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Recording…" : "Record Visit"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteVisitDialog({
  visit,
  onClose,
  onDeleted,
}: {
  visit: VisitSummaryRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteVisitSummaryFn({ data: { id: visit.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete the visit summary.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this visit summary?</AlertDialogTitle>
          <AlertDialogDescription>
            {visit.memberFirstName}'s visit on {formatDate(visit.visitDate)}{" "}
            will be permanently removed.
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
