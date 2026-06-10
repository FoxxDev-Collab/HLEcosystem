import { useState } from "react"
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft, RefreshCw } from "lucide-react"
import {
  getHealthMemberDetailFn,
  syncMemberFromHubFn,
} from "@/server/health/fns.members"
import { formatAge, formatDate, formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/health/family/$id")({
  loader: async ({ params }) => {
    const data = await getHealthMemberDetailFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: MemberDetailPage,
})

function formatBloodType(bt: string): string {
  return bt.replace(/_/g, " ").replace("POSITIVE", "+").replace("NEGATIVE", "-")
}

function MemberDetailPage() {
  const {
    member,
    latestProfile,
    medications,
    appointments,
    vaccinations,
    emergencyContacts,
  } = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const age = formatAge(member.dateOfBirth)

  async function syncFromHub() {
    setError(null)
    setSyncing(true)
    try {
      const result = await syncMemberFromHubFn({ data: { id: member.id } })
      if ("error" in result) {
        setError(result.error)
        return
      }
      router.invalidate()
    } catch {
      setError("Could not sync from the Hub.")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          render={<Link to="/health/family" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {member.relationship && `${member.relationship} · `}
            {member.dateOfBirth
              ? `${age} years old · Born ${formatDate(member.dateOfBirth)}`
              : "Date of birth not set"}
            {member.gender && ` · ${member.gender}`}
          </p>
        </div>
        {member.familyMemberId && (
          <Button
            variant="outline"
            size="sm"
            title="Sync name, DOB and relationship from the Hub"
            disabled={syncing}
            onClick={syncFromHub}
          >
            <RefreshCw className="size-4" /> {syncing ? "Syncing…" : "Sync"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Health Profile</CardTitle>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link to="/health/profiles" search={{ memberId: member.id }} />
              }
            >
              {latestProfile ? "View Records" : "Create Profile"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {latestProfile ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Blood Type</div>
                <div className="text-sm font-medium">
                  {formatBloodType(latestProfile.bloodType)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Height / Weight
                </div>
                <div className="text-sm font-medium">
                  {latestProfile.heightCm !== null
                    ? `${latestProfile.heightCm} cm`
                    : "—"}
                  {" / "}
                  {latestProfile.weightKg !== null
                    ? `${latestProfile.weightKg} kg`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Organ Donor</div>
                <div className="text-sm font-medium">
                  {latestProfile.isOrganDonor ? "Yes" : "No"}
                </div>
              </div>
              {latestProfile.allergies.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="mb-1 text-xs text-muted-foreground">
                    Allergies
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {latestProfile.allergies.map((a) => (
                      <Badge key={a} variant="destructive" className="text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {latestProfile.chronicConditions.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="mb-1 text-xs text-muted-foreground">
                    Chronic Conditions
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {latestProfile.chronicConditions.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No health profile yet.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Medications</CardTitle>
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/health/medications" />}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {medications.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No active medications
              </p>
            ) : (
              <div className="space-y-2">
                {medications.map((med) => (
                  <div key={med.id} className="flex justify-between text-sm">
                    <span className="font-medium">{med.medicationName}</span>
                    <span className="text-muted-foreground">
                      {[med.dosage, med.frequency].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))}
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
                render={
                  <Link
                    to="/health/appointments"
                    search={{ memberId: member.id }}
                  />
                }
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No upcoming appointments
              </p>
            ) : (
              <div className="space-y-2">
                {appointments.map((appt) => (
                  <div key={appt.id} className="flex justify-between text-sm">
                    <span className="font-medium">
                      {appt.appointmentType.replace(/_/g, " ")}
                      {appt.providerName && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {appt.providerName}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(appt.appointmentDateTime)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Vaccinations</CardTitle>
          </CardHeader>
          <CardContent>
            {vaccinations.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No vaccinations recorded
              </p>
            ) : (
              <div className="space-y-2">
                {vaccinations.map((vax) => (
                  <div key={vax.id} className="flex justify-between text-sm">
                    <span className="font-medium">{vax.vaccineName}</span>
                    <span className="text-muted-foreground">
                      {formatDate(vax.dateAdministered)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Emergency Contacts</CardTitle>
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/health/emergency-contacts" />}
              >
                Manage
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {emergencyContacts.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No emergency contacts
              </p>
            ) : (
              <div className="space-y-2">
                {emergencyContacts.map((ec) => (
                  <div key={ec.id} className="flex justify-between text-sm">
                    <span className="font-medium">
                      {ec.name} ({ec.relationship})
                    </span>
                    <span className="text-muted-foreground">
                      {ec.phoneNumber}
                    </span>
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
