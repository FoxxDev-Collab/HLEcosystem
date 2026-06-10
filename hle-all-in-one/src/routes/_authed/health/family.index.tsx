import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { HeartPulse, UserCheck, UserX } from "lucide-react"
import {
  disableHealthTrackingFn,
  enableHealthTrackingFn,
  getHealthFamilyPageFn,
} from "@/server/health/fns.members"
import type { HealthMemberStatsRow } from "@/server/health/members"
import { formatAge } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/_authed/health/family/")({
  loader: () => getHealthFamilyPageFn(),
  component: FamilyTrackingPage,
})

function MemberStatBadges({ member }: { member: HealthMemberStatsRow }) {
  return (
    <div className="flex flex-wrap gap-2">
      {member.profileCount > 0 ? (
        <Badge variant="outline" className="text-xs">
          Profile
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">
          No profile
        </Badge>
      )}
      {member.activeMedicationCount > 0 && (
        <Badge variant="outline" className="text-xs">
          {member.activeMedicationCount} meds
        </Badge>
      )}
      {member.appointmentCount > 0 && (
        <Badge variant="outline" className="text-xs">
          {member.appointmentCount} appts
        </Badge>
      )}
      {member.vaccinationCount > 0 && (
        <Badge variant="outline" className="text-xs">
          {member.vaccinationCount} vaccines
        </Badge>
      )}
    </div>
  )
}

function FamilyTrackingPage() {
  const { hubMembers, healthMembers } = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const trackedByHubId = new Map(
    healthMembers
      .filter((m) => m.familyMemberId !== null)
      .map((m) => [m.familyMemberId, m])
  )
  const legacyMembers = healthMembers.filter((m) => m.familyMemberId === null)

  async function enable(familyMemberId: string) {
    setError(null)
    setPendingId(familyMemberId)
    try {
      const result = await enableHealthTrackingFn({ data: { familyMemberId } })
      if ("error" in result) {
        setError(result.error)
        return
      }
      router.invalidate()
    } catch {
      setError("Could not enable health tracking.")
    } finally {
      setPendingId(null)
    }
  }

  async function disable(id: string) {
    setError(null)
    setPendingId(id)
    try {
      const result = await disableHealthTrackingFn({ data: { id } })
      if ("error" in result) {
        setError(result.error)
        return
      }
      router.invalidate()
    } catch {
      setError("Could not disable health tracking.")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Family Health Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Select family members to track health data for. Members are managed on
          the{" "}
          <Link
            to="/hub/people"
            className="text-primary underline underline-offset-4"
          >
            Hub people page
          </Link>
          .
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {hubMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No family members found. Add members in the Hub first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hubMembers.map((hubMember) => {
            const tracked = trackedByHubId.get(hubMember.id)
            const isTracked = !!tracked && tracked.isActive
            const age = formatAge(hubMember.birthday)
            return (
              <Card
                key={hubMember.id}
                className={isTracked ? "" : "opacity-70"}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {hubMember.firstName} {hubMember.lastName}
                    </CardTitle>
                    {isTracked && (
                      <Badge className="bg-green-600 text-xs text-white">
                        <HeartPulse className="mr-1 size-3" />
                        Tracking
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {hubMember.relationship && `${hubMember.relationship} · `}
                    {age !== null ? `${age} years old` : "Birthday not set"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isTracked && tracked ? (
                    <div className="space-y-3">
                      <MemberStatBadges member={tracked} />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          render={
                            <Link
                              to="/health/family/$id"
                              params={{ id: tracked.id }}
                            />
                          }
                        >
                          View Health
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          title="Stop health tracking"
                          disabled={pendingId === tracked.id}
                          onClick={() => disable(tracked.id)}
                        >
                          <UserX className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={pendingId === hubMember.id}
                      onClick={() => enable(hubMember.id)}
                    >
                      <UserCheck className="size-4" /> Start Health Tracking
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {legacyMembers.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Legacy Members</h2>
            <p className="text-sm text-muted-foreground">
              These members were created before the Hub integration. Add them on
              the Hub people page to link their data.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {legacyMembers.map((member) => {
              const age = formatAge(member.dateOfBirth)
              return (
                <Link
                  key={member.id}
                  to="/health/family/$id"
                  params={{ id: member.id }}
                >
                  <Card
                    className={`h-full cursor-pointer transition-colors hover:bg-accent/50 ${member.isActive ? "" : "opacity-50"}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {member.firstName} {member.lastName}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          Legacy
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {member.relationship && `${member.relationship} · `}
                        {age !== null ? `${age} years old` : "DOB not set"}
                      </div>
                      <div className="mt-3">
                        <MemberStatBadges member={member} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
