import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatAge } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CalendarDays, Pill, Syringe, AlertCircle } from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const now = new Date();
  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const thirtyDaysOut = new Date(now);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  const [
    familyMembers,
    upcomingAppointments,
    activeMedications,
    refillsDue,
    upcomingVaccinations,
    recentVisits,
  ] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId, isActive: true },
      include: { healthProfile: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        familyMember: { householdId },
        status: "SCHEDULED",
        appointmentDateTime: { gte: now, lte: thirtyDaysOut },
      },
      include: { familyMember: true, provider: true },
      orderBy: { appointmentDateTime: "asc" },
      take: 5,
    }),
    prisma.medication.count({
      where: { familyMember: { householdId }, isActive: true },
    }),
    prisma.medication.findMany({
      where: {
        familyMember: { householdId },
        isActive: true,
        nextRefillDate: { lte: sevenDaysOut },
      },
      include: { familyMember: true },
      orderBy: { nextRefillDate: "asc" },
    }),
    prisma.vaccination.findMany({
      where: {
        familyMember: { householdId },
        nextDoseDate: { lte: thirtyDaysOut, gte: now },
      },
      include: { familyMember: true },
      orderBy: { nextDoseDate: "asc" },
      take: 5,
    }),
    prisma.visitSummary.findMany({
      where: { familyMember: { householdId } },
      include: { familyMember: true, provider: true },
      orderBy: { visitDate: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Health Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Family Members</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyMembers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
            <CalendarDays className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Medications</CardTitle>
            <Pill className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMedications}</div>
            {refillsDue.length > 0 && (
              <p className="text-xs text-orange-600">{refillsDue.length} refill(s) due soon</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Vaccinations</CardTitle>
            <Syringe className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingVaccinations.length}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {refillsDue.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="size-4 text-orange-600" />
              Medication Refills Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {refillsDue.map((med) => (
                <div key={med.id} className="flex justify-between text-sm">
                  <span>{med.medicationName} — {med.familyMember.firstName}</span>
                  <span className="text-muted-foreground">
                    {med.nextRefillDate ? formatDate(med.nextRefillDate) : "No date"}
                    {med.refillsRemaining !== null && ` (${med.refillsRemaining} refills left)`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Family Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Family Members</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/family">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {familyMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                <Link href="/family" className="text-blue-500 hover:underline">Add your first family member</Link>
              </p>
            ) : (
              <div className="space-y-3">
                {familyMembers.map((member) => (
                  <Link
                    key={member.id}
                    href={`/family/${member.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium">{member.firstName} {member.lastName}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.relationship && `${member.relationship} · `}
                        {member.dateOfBirth
                          ? `${formatAge(member.dateOfBirth)} years old`
                          : ""}
                      </div>
                    </div>
                    {member.healthProfile ? (
                      <Badge variant="outline" className="text-xs">Profile</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No profile</Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Appointments</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/appointments">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming appointments</p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div>
                      <div className="text-sm font-medium">{appt.familyMember.firstName} — {appt.appointmentType.replace(/_/g, " ")}</div>
                      <div className="text-xs text-muted-foreground">
                        {appt.provider?.name}
                        {appt.location && ` · ${appt.location}`}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{formatDate(appt.appointmentDateTime)}</div>
                      <div className="text-xs text-muted-foreground">
                        {appt.appointmentDateTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Visits */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Visit Summaries</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/visits">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No visit records yet</p>
            ) : (
              <div className="divide-y">
                {recentVisits.map((visit) => (
                  <div key={visit.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium">
                        {visit.familyMember.firstName} — {visit.visitType.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {visit.provider?.name}
                        {visit.chiefComplaint && ` · ${visit.chiefComplaint}`}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{formatDate(visit.visitDate)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
