import { Link, createFileRoute } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  GraduationCap,
  Trophy,
  Users,
} from "lucide-react"
import { getEducationOverviewFn } from "@/server/hub/fns.education"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/hub/education/")({
  loader: () => getEducationOverviewFn(),
  component: EducationOverviewPage,
})

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  const expiry = new Date(y, m - 1, d)
  return Math.ceil((expiry.getTime() - Date.now()) / 86400000)
}

function EducationOverviewPage() {
  const { members, expiringCerts } = Route.useLoaderData()

  const totalStudents = members.filter(
    (m) => m.currentInstitution !== null
  ).length
  const totalActivities = members.reduce((sum, m) => sum + m.activityCount, 0)
  const totalAchievements = members.reduce(
    (sum, m) => sum + m.achievementCount,
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Education</h1>
        <p className="text-sm text-muted-foreground">
          Track schooling, activities, achievements, and certifications for your
          family.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={
            <GraduationCap className="size-4 text-blue-600 dark:text-blue-400" />
          }
          iconBg="bg-blue-100 dark:bg-blue-900/40"
          value={totalStudents}
          label="Current Students"
        />
        <StatCard
          icon={
            <Trophy className="size-4 text-green-600 dark:text-green-400" />
          }
          iconBg="bg-green-100 dark:bg-green-900/40"
          value={totalActivities}
          label="Active Activities"
        />
        <StatCard
          icon={
            <Award className="size-4 text-purple-600 dark:text-purple-400" />
          }
          iconBg="bg-purple-100 dark:bg-purple-900/40"
          value={totalAchievements}
          label="Achievements"
        />
        <StatCard
          icon={
            <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400" />
          }
          iconBg="bg-yellow-100 dark:bg-yellow-900/40"
          value={expiringCerts.length}
          label="Expiring Certs (30d)"
        />
      </div>

      {expiringCerts.length > 0 && (
        <Card className="border-yellow-300 dark:border-yellow-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="size-4" />
              Certifications Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringCerts.map((cert) => {
                const days = daysUntil(cert.expirationDate)
                return (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-medium">{cert.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        &mdash; {cert.firstName} {cert.lastName}
                      </span>
                    </div>
                    <Badge
                      variant={days <= 0 ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {days <= 0
                        ? "Expired"
                        : `${days} day${days !== 1 ? "s" : ""}`}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <Link
            key={member.id}
            to="/hub/education/$memberId"
            params={{ memberId: member.id }}
          >
            <Card className="h-full cursor-pointer transition-colors hover:bg-accent/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {member.firstName} {member.lastName}
                    </p>
                    {member.currentInstitution ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        <GraduationCap className="mr-1 inline size-3" />
                        {member.currentInstitution}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        No current education
                      </p>
                    )}
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {member.activityCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {member.activityCount} activit
                      {member.activityCount !== 1 ? "ies" : "y"}
                    </Badge>
                  )}
                  {member.achievementCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {member.achievementCount} achievement
                      {member.achievementCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {member.activeCertCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {member.activeCertCount} cert
                      {member.activeCertCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {members.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No family members yet.{" "}
              <Link to="/hub/people" className="text-primary hover:underline">
                Add people
              </Link>{" "}
              to start tracking education.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          to="/hub/education/grades"
          icon={<BookOpen className="mr-2 size-4" />}
          title="Grade Reports"
          description="Enter and view grade reports"
        />
        <QuickLink
          to="/hub/education/activities"
          icon={<Trophy className="mr-2 size-4" />}
          title="Activities"
          description="Sports, clubs, music, and more"
        />
        <QuickLink
          to="/hub/education/certifications"
          icon={<Award className="mr-2 size-4" />}
          title="Certifications"
          description="Track credentials and renewals"
        />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode
  iconBg: string
  value: number
  label: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 items-center justify-center rounded-lg ${iconBg}`}
          >
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickLink({
  to,
  icon,
  title,
  description,
}: {
  to:
    | "/hub/education/grades"
    | "/hub/education/activities"
    | "/hub/education/certifications"
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Button
      variant="outline"
      className="h-auto justify-start py-3"
      render={<Link to={to} />}
    >
      {icon}
      <div className="text-left">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
    </Button>
  )
}
