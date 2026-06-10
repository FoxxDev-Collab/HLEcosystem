import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react"
import {
  createAppointmentFn,
  deleteAppointmentFn,
  getHealthAppointmentsPageFn,
  updateAppointmentStatusFn,
} from "@/server/health/fns.appointments"
import type {
  AppointmentRow,
  AppointmentStatus,
  AppointmentType,
} from "@/server/health/appointments"
import type { MemberOption } from "@/server/health/members"
import type { ProviderOption } from "@/server/health/providers"
import { formatDate, formatDateTime } from "@/lib/format"
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

export const Route = createFileRoute("/_authed/health/appointments")({
  validateSearch: (search: Record<string, unknown>): { memberId?: string } => ({
    memberId: typeof search.memberId === "string" ? search.memberId : undefined,
  }),
  loaderDeps: ({ search }) => ({ memberId: search.memberId ?? null }),
  loader: ({ deps }) =>
    getHealthAppointmentsPageFn({ data: { memberId: deps.memberId } }),
  component: AppointmentsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const APPT_TYPES: Array<AppointmentType> = [
  "ANNUAL_CHECKUP",
  "FOLLOW_UP",
  "SPECIALIST",
  "PROCEDURE",
  "LAB_WORK",
  "DENTAL",
  "VISION",
  "URGENT_CARE",
  "TELEHEALTH",
  "OTHER",
]

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  NO_SHOW: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  RESCHEDULED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
}

function AppointmentsPage() {
  const { members, providers, appointments } = Route.useLoaderData()
  const { memberId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppointmentRow | null>(null)

  const now = new Date()
  const upcoming = appointments.filter(
    (a) => a.status === "SCHEDULED" && new Date(a.appointmentDateTime) >= now
  )
  const past = appointments.filter(
    (a) => a.status !== "SCHEDULED" || new Date(a.appointmentDateTime) < now
  )

  // Current-month calendar of upcoming appointments (legacy feature).
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay()
  const apptsByDay = new Map<number, Array<AppointmentRow>>()
  for (const appt of upcoming) {
    const d = new Date(appt.appointmentDateTime)
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      const existing = apptsByDay.get(d.getDate()) ?? []
      existing.push(appt)
      apptsByDay.set(d.getDate(), existing)
    }
  }

  function refresh() {
    router.invalidate()
  }

  async function setStatus(id: string, status: AppointmentStatus) {
    setError(null)
    try {
      const result = await updateAppointmentStatusFn({ data: { id, status } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      refresh()
    } catch {
      setError("Could not update the appointment.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        {members.length > 0 && (
          <select
            className={`${selectClass} w-48`}
            value={memberId ?? ""}
            onChange={(e) =>
              navigate({
                search: { memberId: e.target.value || undefined },
              })
            }
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ScheduleAppointmentCard
        members={members}
        providers={providers}
        defaultMemberId={memberId}
        onSaved={refresh}
      />

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {now.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-muted">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="bg-background py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="min-h-[50px] bg-background"
                />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayAppts = apptsByDay.get(day) ?? []
                const isToday = day === now.getDate()
                return (
                  <div
                    key={day}
                    className={`min-h-[50px] bg-background p-1 ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
                  >
                    <div
                      className={`text-xs font-medium ${isToday ? "text-primary" : ""}`}
                    >
                      {day}
                    </div>
                    {dayAppts.map((a) => (
                      <div
                        key={a.id}
                        className="mb-0.5 truncate rounded bg-blue-100 px-0.5 text-[10px] leading-tight text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      >
                        {a.memberFirstName}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Upcoming ({upcoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {upcoming.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {appt.memberFirstName} —{" "}
                      {appt.appointmentType.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(appt.appointmentDateTime)}
                      {appt.providerName && ` · ${appt.providerName}`}
                      {appt.location && ` · ${appt.location}`}
                      {appt.reasonForVisit && ` · ${appt.reasonForVisit}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Mark complete"
                      onClick={() => setStatus(appt.id, "COMPLETED")}
                    >
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Cancel appointment"
                      onClick={() => setStatus(appt.id, "CANCELLED")}
                    >
                      <XCircle className="size-3.5 text-destructive" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => setDeleteTarget(appt)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Past & Other ({past.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {past.slice(0, 20).map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between gap-4 py-3 opacity-70"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {appt.memberFirstName} —{" "}
                      {appt.appointmentType.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(appt.appointmentDateTime)}
                      {appt.providerName && ` · ${appt.providerName}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge className={STATUS_COLORS[appt.status]}>
                      {appt.status.replace(/_/g, " ")}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => setDeleteTarget(appt)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {appointments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No appointments yet. Schedule one above.
            </p>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteAppointmentDialog
          appointment={deleteTarget}
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

function ScheduleAppointmentCard({
  members,
  providers,
  defaultMemberId,
  onSaved,
}: {
  members: Array<MemberOption>
  providers: Array<ProviderOption>
  defaultMemberId: string | undefined
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
      const result = await createAppointmentFn({
        data: {
          memberId: String(f.get("memberId") ?? ""),
          providerId: String(f.get("providerId") ?? ""),
          date: String(f.get("date") ?? ""),
          time: String(f.get("time") ?? "09:00"),
          durationMinutes: Number(f.get("durationMinutes") ?? 30) || 30,
          appointmentType: String(
            f.get("appointmentType") ?? "ANNUAL_CHECKUP"
          ) as AppointmentType,
          location: String(f.get("location") ?? ""),
          reasonForVisit: String(f.get("reasonForVisit") ?? ""),
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
      setError("Could not schedule the appointment.")
      setPending(false)
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Enable health tracking for a family member first to schedule
          appointments.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Schedule Appointment</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="appt-member">Family Member</Label>
            <select
              id="appt-member"
              name="memberId"
              className={selectClass}
              defaultValue={defaultMemberId ?? members[0]?.id}
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
            <Label htmlFor="appt-type">Type</Label>
            <select
              id="appt-type"
              name="appointmentType"
              className={selectClass}
              defaultValue="ANNUAL_CHECKUP"
            >
              {APPT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="appt-date">Date</Label>
            <Input id="appt-date" name="date" type="date" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="appt-time">Time</Label>
            <Input
              id="appt-time"
              name="time"
              type="time"
              defaultValue="09:00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="appt-duration">Duration (min)</Label>
            <Input
              id="appt-duration"
              name="durationMinutes"
              type="number"
              min="5"
              max="1440"
              defaultValue={30}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="appt-provider">Provider</Label>
            <select
              id="appt-provider"
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
            <Label htmlFor="appt-location">Location</Label>
            <Input id="appt-location" name="location" placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="appt-reason">Reason</Label>
            <Input
              id="appt-reason"
              name="reasonForVisit"
              placeholder="Optional"
            />
          </div>
          <Button type="submit" disabled={pending} className="lg:col-span-4">
            <Plus className="size-4" />
            {pending ? "Scheduling…" : "Schedule"}
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

function DeleteAppointmentDialog({
  appointment,
  onClose,
  onDeleted,
}: {
  appointment: AppointmentRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteAppointmentFn({
        data: { id: appointment.id },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete the appointment.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
          <AlertDialogDescription>
            {appointment.memberFirstName}'s{" "}
            {appointment.appointmentType.replace(/_/g, " ").toLowerCase()} on{" "}
            {formatDate(appointment.appointmentDateTime)} will be permanently
            removed.
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
