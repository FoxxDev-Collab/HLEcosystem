import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type {
  PetAppointmentRow,
  PetAppointmentStatus,
  PetAppointmentType,
  VetProviderRow,
} from "@/server/health/pets"
import {
  addPetAppointmentFn,
  deletePetAppointmentFn,
  setPetAppointmentStatusFn,
} from "@/server/health/fns.pets"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formIntOrNull, formStr, selectClass } from "./health-shared"

const APPOINTMENT_TYPES: Array<PetAppointmentType> = [
  "WELLNESS_EXAM",
  "VACCINATION",
  "DENTAL",
  "SURGERY",
  "EMERGENCY",
  "GROOMING",
  "LAB_WORK",
  "FOLLOW_UP",
  "OTHER",
]

const STATUS_VARIANTS: Record<
  PetAppointmentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  SCHEDULED: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
  RESCHEDULED: "outline",
}

function enumLabel(value: string): string {
  return value.replace(/_/g, " ")
}

export function PetAppointmentsTab({
  petId,
  appointments,
  vetProviders,
  onChanged,
}: {
  petId: string
  appointments: Array<PetAppointmentRow>
  vetProviders: Array<VetProviderRow>
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const type = formStr(f, "appointmentType")
    try {
      const result = await addPetAppointmentFn({
        data: {
          petId,
          appointmentDateTime: formStr(f, "appointmentDateTime"),
          durationMinutes: formIntOrNull(f, "durationMinutes") ?? 30,
          appointmentType: APPOINTMENT_TYPES.find((t) => t === type) ?? "OTHER",
          providerId: formStr(f, "providerId"),
          location: formStr(f, "location"),
          reasonForVisit: formStr(f, "reasonForVisit"),
          notes: "",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        form.reset()
        onChanged()
      }
    } catch {
      setError("Could not schedule appointment.")
    }
    setPending(false)
  }

  async function setStatus(id: string, status: PetAppointmentStatus) {
    setError(null)
    try {
      const result = await setPetAppointmentStatusFn({ data: { id, status } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not update appointment.")
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      const result = await deletePetAppointmentFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not delete appointment.")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Schedule Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSubmit}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="papt-when">Date &amp; Time</Label>
              <Input
                id="papt-when"
                name="appointmentDateTime"
                type="datetime-local"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="papt-type">Type</Label>
              <select
                id="papt-type"
                name="appointmentType"
                className={selectClass}
                defaultValue="WELLNESS_EXAM"
              >
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {enumLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            {vetProviders.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="papt-provider">Provider</Label>
                <select
                  id="papt-provider"
                  name="providerId"
                  className={selectClass}
                  defaultValue=""
                >
                  <option value="">Select vet</option>
                  {vetProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="papt-duration">Duration (min)</Label>
              <Input
                id="papt-duration"
                name="durationMinutes"
                type="number"
                min="1"
                defaultValue={30}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="papt-location">Location</Label>
              <Input id="papt-location" name="location" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="papt-reason">Reason for Visit</Label>
              <Input
                id="papt-reason"
                name="reasonForVisit"
                placeholder="e.g. Annual checkup"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive lg:col-span-4">{error}</p>
            )}
            <Button type="submit" disabled={pending} className="lg:col-span-4">
              <Plus className="size-4" />
              {pending ? "Scheduling…" : "Schedule"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointment History</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No appointments recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {formatDateTime(a.appointmentDateTime)}
                    </TableCell>
                    <TableCell>{enumLabel(a.appointmentType)}</TableCell>
                    <TableCell>{a.providerName || "—"}</TableCell>
                    <TableCell>{a.reasonForVisit || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[a.status]}>
                        {enumLabel(a.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.cost !== null ? formatCurrency(a.cost) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {a.status === "SCHEDULED" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setStatus(a.id, "COMPLETED")}
                            >
                              Complete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => setStatus(a.id, "CANCELLED")}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Delete appointment"
                          onClick={() => remove(a.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
