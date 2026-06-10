import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { Minus, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react"
import {
  createProfileRecordFn,
  deleteProfileRecordFn,
  getHealthProfilesPageFn,
} from "@/server/health/fns.profiles"
import type { BloodType, ProfileRecordRow } from "@/server/health/profiles"
import { formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/health/profiles")({
  validateSearch: (search: Record<string, unknown>): { memberId?: string } => ({
    memberId: typeof search.memberId === "string" ? search.memberId : undefined,
  }),
  loader: () => getHealthProfilesPageFn(),
  component: ProfilesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const BLOOD_TYPES: Array<BloodType> = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
  "UNKNOWN",
]

function formatBloodType(bt: string): string {
  return bt.replace(/_/g, " ").replace("POSITIVE", "+").replace("NEGATIVE", "-")
}

// Legacy display rule: metric is stored, imperial is shown alongside.
function formatHeight(cm: number | null): string {
  if (!cm) return "—"
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}'${inches}" (${cm} cm)`
}

function formatWeight(kg: number | null): string {
  if (!kg) return "—"
  const lbs = Math.round(kg * 2.20462)
  return `${lbs} lbs (${kg} kg)`
}

function WeightTrend({
  current,
  previous,
}: {
  current: number | null
  previous: number | null
}) {
  if (!current || !previous) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.1) {
    return <Minus className="size-3.5 text-muted-foreground" />
  }
  if (diff > 0) return <TrendingUp className="size-3.5 text-orange-500" />
  return <TrendingDown className="size-3.5 text-blue-500" />
}

function ProfilesPage() {
  const { members, records } = Route.useLoaderData()
  const { memberId } = Route.useSearch()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<ProfileRecordRow | null>(
    null
  )

  const recordsByMember = new Map<string, Array<ProfileRecordRow>>()
  for (const record of records) {
    const existing = recordsByMember.get(record.memberId) ?? []
    existing.push(record)
    recordsByMember.set(record.memberId, existing)
  }

  const selectedMemberId =
    memberId && members.some((m) => m.id === memberId)
      ? memberId
      : members[0]?.id
  const selectedMember = members.find((m) => m.id === selectedMemberId)
  const memberRecords = selectedMember
    ? (recordsByMember.get(selectedMember.id) ?? [])
    : []
  const latestRecord = memberRecords[0] ?? null

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Health Profiles</h1>
        <p className="text-sm text-muted-foreground">
          Track health info over time. Each save creates a new record so you can
          see how height, weight, and conditions change.
        </p>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Enable health tracking for a family member first to create health
              profiles.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const count = recordsByMember.get(m.id)?.length ?? 0
              return (
                <Link
                  key={m.id}
                  to="/health/profiles"
                  search={{ memberId: m.id }}
                >
                  <Badge
                    variant={m.id === selectedMemberId ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1.5"
                  >
                    {m.firstName} {m.lastName}
                    {count > 0 && ` (${count})`}
                  </Badge>
                </Link>
              )
            })}
          </div>

          {selectedMember && (
            <>
              <NewRecordCard
                key={`${selectedMember.id}-${latestRecord?.id ?? "none"}`}
                memberId={selectedMember.id}
                memberFirstName={selectedMember.firstName}
                latestRecord={latestRecord}
                onSaved={refresh}
              />

              {memberRecords.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Record History ({memberRecords.length})
                    </CardTitle>
                    <CardDescription>
                      Health profile records over time for{" "}
                      {selectedMember.firstName}. Most recent first.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {memberRecords.map((record, idx) => {
                        const prev = memberRecords[idx + 1] ?? null
                        return (
                          <div
                            key={record.id}
                            className={`rounded-lg border p-4 ${idx === 0 ? "border-primary/30 bg-primary/5" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="font-medium">
                                    {formatDate(record.recordDate)}
                                  </span>
                                  {idx === 0 && <Badge>Current</Badge>}
                                </div>
                                <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">
                                      Height:
                                    </span>
                                    <span>{formatHeight(record.heightCm)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">
                                      Weight:
                                    </span>
                                    <span>{formatWeight(record.weightKg)}</span>
                                    <WeightTrend
                                      current={record.weightKg}
                                      previous={prev?.weightKg ?? null}
                                    />
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Blood Type:
                                    </span>{" "}
                                    <span>
                                      {formatBloodType(record.bloodType)}
                                    </span>
                                  </div>
                                  {record.primaryCareProvider && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        PCP:
                                      </span>{" "}
                                      <span>{record.primaryCareProvider}</span>
                                    </div>
                                  )}
                                  {record.preferredHospital && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Hospital:
                                      </span>{" "}
                                      <span>{record.preferredHospital}</span>
                                    </div>
                                  )}
                                  {record.isOrganDonor && (
                                    <div>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Organ Donor
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                                {record.allergies.length > 0 && (
                                  <div className="mt-1 text-sm">
                                    <span className="text-muted-foreground">
                                      Allergies:
                                    </span>{" "}
                                    {record.allergies.map((a) => (
                                      <Badge
                                        key={a}
                                        variant="secondary"
                                        className="mr-1 text-xs"
                                      >
                                        {a}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {record.chronicConditions.length > 0 && (
                                  <div className="mt-1 text-sm">
                                    <span className="text-muted-foreground">
                                      Conditions:
                                    </span>{" "}
                                    {record.chronicConditions.map((c) => (
                                      <Badge
                                        key={c}
                                        variant="secondary"
                                        className="mr-1 text-xs"
                                      >
                                        {c}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {record.majorSurgeries.length > 0 && (
                                  <div className="mt-1 text-sm">
                                    <span className="text-muted-foreground">
                                      Surgeries:
                                    </span>{" "}
                                    {record.majorSurgeries.join(", ")}
                                  </div>
                                )}
                                {record.medicalNotes && (
                                  <div className="mt-1 text-sm text-muted-foreground italic">
                                    {record.medicalNotes}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                title="Delete record"
                                onClick={() => setDeleteTarget(record)}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {deleteTarget && (
        <DeleteRecordDialog
          record={deleteTarget}
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

function NewRecordCard({
  memberId,
  memberFirstName,
  latestRecord,
  onSaved,
}: {
  memberId: string
  memberFirstName: string
  latestRecord: ProfileRecordRow | null
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
    const num = (key: string): number | null => {
      const v = String(f.get(key) ?? "").trim()
      if (!v) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    try {
      const result = await createProfileRecordFn({
        data: {
          memberId,
          recordDate: String(f.get("recordDate") ?? ""),
          bloodType: String(f.get("bloodType") ?? "UNKNOWN") as BloodType,
          heightCm: num("heightCm"),
          weightKg: num("weightKg"),
          allergies: String(f.get("allergies") ?? ""),
          chronicConditions: String(f.get("chronicConditions") ?? ""),
          majorSurgeries: String(f.get("majorSurgeries") ?? ""),
          primaryCareProvider: String(f.get("primaryCareProvider") ?? ""),
          preferredHospital: String(f.get("preferredHospital") ?? ""),
          medicalNotes: String(f.get("medicalNotes") ?? ""),
          isOrganDonor: f.get("isOrganDonor") === "on",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      setPending(false)
      onSaved()
    } catch {
      setError("Could not save the record.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="size-4" />
          New Record for {memberFirstName}
        </CardTitle>
        <CardDescription>
          {latestRecord
            ? "Pre-filled from the most recent record. Update what changed and save."
            : "Create the first health profile record."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="profile-recordDate">Record Date</Label>
              <Input
                id="profile-recordDate"
                name="recordDate"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-bloodType">Blood Type</Label>
              <select
                id="profile-bloodType"
                name="bloodType"
                className={selectClass}
                defaultValue={latestRecord?.bloodType ?? "UNKNOWN"}
              >
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {formatBloodType(bt)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-heightCm">Height (cm)</Label>
              <Input
                id="profile-heightCm"
                name="heightCm"
                type="number"
                step="0.01"
                min="0"
                defaultValue={latestRecord?.heightCm ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-weightKg">Weight (kg)</Label>
              <Input
                id="profile-weightKg"
                name="weightKg"
                type="number"
                step="0.01"
                min="0"
                defaultValue={latestRecord?.weightKg ?? ""}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                name="isOrganDonor"
                id="profile-isOrganDonor"
                defaultChecked={latestRecord?.isOrganDonor ?? false}
                className="size-4 accent-primary"
              />
              <Label htmlFor="profile-isOrganDonor">Organ Donor</Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="profile-pcp">Primary Care Provider</Label>
              <Input
                id="profile-pcp"
                name="primaryCareProvider"
                defaultValue={latestRecord?.primaryCareProvider ?? ""}
                placeholder="Dr. Smith"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-hospital">Preferred Hospital</Label>
              <Input
                id="profile-hospital"
                name="preferredHospital"
                defaultValue={latestRecord?.preferredHospital ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="profile-allergies">
              Allergies (comma-separated)
            </Label>
            <Input
              id="profile-allergies"
              name="allergies"
              defaultValue={latestRecord?.allergies.join(", ") ?? ""}
              placeholder="Penicillin, Peanuts, Shellfish"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="profile-conditions">
              Chronic Conditions (comma-separated)
            </Label>
            <Input
              id="profile-conditions"
              name="chronicConditions"
              defaultValue={latestRecord?.chronicConditions.join(", ") ?? ""}
              placeholder="Asthma, Diabetes"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="profile-surgeries">
              Major Surgeries (comma-separated)
            </Label>
            <Input
              id="profile-surgeries"
              name="majorSurgeries"
              defaultValue={latestRecord?.majorSurgeries.join(", ") ?? ""}
              placeholder="Appendectomy 2020"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="profile-notes">Medical Notes</Label>
            <Textarea
              id="profile-notes"
              name="medicalNotes"
              defaultValue={latestRecord?.medicalNotes ?? ""}
              rows={3}
            />
          </div>

          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Saving…" : "Save New Record"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteRecordDialog({
  record,
  onClose,
  onDeleted,
}: {
  record: ProfileRecordRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteProfileRecordFn({ data: { id: record.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete the record.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete record from {formatDate(record.recordDate)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This health profile record will be permanently removed from the
            history.
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
