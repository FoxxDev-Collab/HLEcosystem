import { createFileRoute, Link } from "@tanstack/react-router"
import { AlertCircle, CalendarDays, Pill, Syringe, Users } from "lucide-react"
import { getHealthDashboardFn } from "@/server/health/fns.dashboard"
import { formatAge, formatDate, formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/health/dashboard")({
  loader: () => getHealthDashboardFn(),
  component: HealthDashboardPage,
})

function HealthDashboardPage() {
  const {
    members,
    upcomingAppointments,
    activeMedicationCount,
    refillsDue,
    upcomingVaccinations,
    recentVisits,
  } = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Health Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Household health at a glance — appointments, medications and visits.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Family Members
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Appointments
            </CardTitle>
            <CalendarDays className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingAppointments.length}
            </div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Medications
            </CardTitle>
            <Pill className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMedicationCount}</div>
            {refillsDue.length > 0 && (
              <p className="text-xs text-orange-600">
                {refillsDue.length} refill(s) due soon
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Vaccinations
            </CardTitle>
            <Syringe className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingVaccinations.length}
            </div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
      </div>

      {refillsDue.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="size-4 text-orange-600" />
              Medication Refills Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {refillsDue.map((med) => (
                <div key={med.id} className="flex justify-between text-sm">
                  <span>
                    {med.medicationName} — {med.memberFirstName}
                  </span>
                  <span className="text-muted-foreground">
                    {med.nextRefillDate
                      ? formatDate(med.nextRefillDate)
                      : "No date"}
                    {med.refillsRemaining !== null &&
                      ` (${med.refillsRemaining} refills left)`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingVaccinations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Syringe className="size-4 text-muted-foreground" />
              Vaccinations Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingVaccinations.map((vax) => (
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Family Members</CardTitle>
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/health/family" />}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                <Link
                  to="/health/family"
                  className="text-primary underline underline-offset-4"
                >
                  Enable health tracking for your first family member
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {members.map((member) => {
                  const age = formatAge(member.dateOfBirth)
                  return (
                    <Link
                      key={member.id}
                      to="/health/family/$id"
                      params={{ id: member.id }}
                      className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-accent/50"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {member.relationship && `${member.relationship} · `}
                          {age !== null ? `${age} years old` : ""}
                        </div>
                      </div>
                      {member.hasProfile ? (
                        <Badge variant="outline" className="text-xs">
                          Profile
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          No profile
                        </Badge>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Upcoming Appointments</CardTitle>
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/health/appointments" />}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No upcoming appointments
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {appt.memberFirstName} —{" "}
                        {appt.appointmentType.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {appt.providerName}
                        {appt.location && ` · ${appt.location}`}
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium">
                      {formatDateTime(appt.appointmentDateTime)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Recent Visit Summaries
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/health/visits" />}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No visit records yet
              </p>
            ) : (
              <div className="divide-y">
                {recentVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {visit.memberFirstName} —{" "}
                        {visit.visitType.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {visit.providerName}
                        {visit.chiefComplaint && ` · ${visit.chiefComplaint}`}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(visit.visitDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
