import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  GraduationCap,
  Users,
  Award,
  AlertTriangle,
  ArrowRight,
  Trophy,
  BookOpen,
} from "lucide-react";

export default async function EducationOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const members = await prisma.familyMember.findMany({
    where: { householdId, isActive: true },
    include: {
      educationEntries: {
        where: { isCurrent: true },
        orderBy: { startDate: "desc" },
        take: 1,
      },
      activities: {
        where: { isCurrent: true },
      },
      certifications: true,
      achievements: true,
    },
    orderBy: { firstName: "asc" },
  });

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Stats
  const totalStudents = members.filter(
    (m) => m.educationEntries.length > 0
  ).length;
  const totalActivities = members.reduce(
    (sum, m) => sum + m.activities.length,
    0
  );
  const totalAchievements = members.reduce(
    (sum, m) => sum + m.achievements.length,
    0
  );

  const expiringCerts = members.flatMap((m) =>
    m.certifications.filter(
      (c) =>
        c.expirationDate &&
        new Date(c.expirationDate) <= thirtyDaysFromNow &&
        c.status === "ACTIVE"
    )
  );

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Education</h1>
        <p className="text-muted-foreground text-sm">
          Track schooling, activities, achievements, and certifications for your
          family.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <GraduationCap className="size-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-xs text-muted-foreground">
                  Current Students
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                <Trophy className="size-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalActivities}</p>
                <p className="text-xs text-muted-foreground">
                  Active Activities
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                <Award className="size-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAchievements}</p>
                <p className="text-xs text-muted-foreground">Achievements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/40">
                <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiringCerts.length}</p>
                <p className="text-xs text-muted-foreground">
                  Expiring Certs (30d)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring certifications alert */}
      {expiringCerts.length > 0 && (
        <Card className="border-yellow-300 dark:border-yellow-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="size-4" />
              Certifications Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringCerts.map((cert) => {
                const member = members.find(
                  (m) => m.id === cert.familyMemberId
                );
                const daysUntil = cert.expirationDate
                  ? Math.ceil(
                      (new Date(cert.expirationDate).getTime() - now.getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0;
                return (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-medium">{cert.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        &mdash;{" "}
                        {member
                          ? `${member.firstName} ${member.lastName}`
                          : "Unknown"}
                      </span>
                    </div>
                    <Badge
                      variant={daysUntil <= 0 ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {daysUntil <= 0
                        ? "Expired"
                        : `${daysUntil} day${daysUntil !== 1 ? "s" : ""}`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Family Members */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => {
          const currentSchool = member.educationEntries[0];
          const activeCerts = member.certifications.filter(
            (c) => c.status === "ACTIVE"
          ).length;

          return (
            <Link key={member.id} href={`/education/${member.id}`}>
              <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      {currentSchool ? (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          <GraduationCap className="size-3 inline mr-1" />
                          {currentSchool.institution}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          No current education
                        </p>
                      )}
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {member.activities.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {member.activities.length} activit
                        {member.activities.length !== 1 ? "ies" : "y"}
                      </Badge>
                    )}
                    {member.achievements.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {member.achievements.length} achievement
                        {member.achievements.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {activeCerts > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {activeCerts} cert{activeCerts !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {members.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No family members yet.{" "}
              <Link href="/people" className="text-primary hover:underline">
                Add people
              </Link>{" "}
              to start tracking education.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" className="h-auto py-3 justify-start" asChild>
          <Link href="/education/grades">
            <BookOpen className="size-4 mr-2" />
            <div className="text-left">
              <p className="text-sm font-medium">Grade Reports</p>
              <p className="text-[10px] text-muted-foreground">
                Enter and view grade reports
              </p>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 justify-start" asChild>
          <Link href="/education/activities">
            <Trophy className="size-4 mr-2" />
            <div className="text-left">
              <p className="text-sm font-medium">Activities</p>
              <p className="text-[10px] text-muted-foreground">
                Sports, clubs, music, and more
              </p>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 justify-start" asChild>
          <Link href="/education/certifications">
            <Award className="size-4 mr-2" />
            <div className="text-left">
              <p className="text-sm font-medium">Certifications</p>
              <p className="text-[10px] text-muted-foreground">
                Track credentials and renewals
              </p>
            </div>
          </Link>
        </Button>
      </div>
    </div>
  );
}
