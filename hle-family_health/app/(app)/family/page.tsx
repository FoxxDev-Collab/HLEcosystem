import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getFamilyHubMembers } from "@/lib/familyhub-members";
import prisma from "@/lib/prisma";
import { formatAge } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeartPulse, ExternalLink, UserCheck, UserX } from "lucide-react";
import { enableHealthTrackingAction, disableHealthTrackingAction } from "./actions";

export default async function FamilyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  // Get members from FamilyHub (source of truth)
  const hubMembers = await getFamilyHubMembers(householdId);

  // Get locally tracked health members
  const healthMembers = await prisma.familyMember.findMany({
    where: { householdId },
    include: {
      healthProfiles: { orderBy: { recordDate: "desc" }, take: 1 },
      _count: {
        select: {
          medications: { where: { isActive: true } },
          appointments: true,
          vaccinations: true,
        },
      },
    },
  });

  // Map FamilyHub member ID → local health member
  const trackedMap = new Map(
    healthMembers
      .filter((m) => m.familyhubMemberId)
      .map((m) => [m.familyhubMemberId!, m])
  );

  // Also find legacy members (created before this change, no familyhubMemberId)
  const legacyMembers = healthMembers.filter((m) => !m.familyhubMemberId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Family Health Tracking</h1>
        <p className="text-muted-foreground">
          Select family members to track health data for. Members are managed in{" "}
          <a href={`${process.env.AUTH_URL?.replace(":8080", ":8081") || "http://localhost:8081"}/people`} className="text-primary underline underline-offset-4 inline-flex items-center gap-1">
            FamilyHub <ExternalLink className="size-3" />
          </a>
        </p>
      </div>

      {hubMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No family members found. Add members in FamilyHub first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hubMembers.map((hubMember) => {
            const tracked = trackedMap.get(hubMember.id);
            const isTracked = !!tracked && tracked.isActive;

            return (
              <Card key={hubMember.id} className={`relative ${isTracked ? "" : "opacity-70"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {hubMember.firstName} {hubMember.lastName}
                    </CardTitle>
                    {isTracked && (
                      <Badge variant="default" className="text-xs bg-green-600">
                        <HeartPulse className="size-3 mr-1" />Tracking
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {hubMember.relationship && `${hubMember.relationship} · `}
                    {hubMember.birthday
                      ? `${formatAge(hubMember.birthday)} years old`
                      : "Birthday not set"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isTracked && tracked ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {tracked.healthProfiles.length > 0 ? (
                          <Badge variant="outline" className="text-xs">Profile</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">No profile</Badge>
                        )}
                        {tracked._count.medications > 0 && (
                          <Badge variant="outline" className="text-xs">{tracked._count.medications} meds</Badge>
                        )}
                        {tracked._count.appointments > 0 && (
                          <Badge variant="outline" className="text-xs">{tracked._count.appointments} appts</Badge>
                        )}
                        {tracked._count.vaccinations > 0 && (
                          <Badge variant="outline" className="text-xs">{tracked._count.vaccinations} vaccines</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild className="flex-1">
                          <Link href={`/family/${tracked.id}`}>
                            View Health
                          </Link>
                        </Button>
                        <form action={disableHealthTrackingAction}>
                          <input type="hidden" name="id" value={tracked.id} />
                          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                            <UserX className="size-4" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <form action={enableHealthTrackingAction}>
                      <input type="hidden" name="familyhubMemberId" value={hubMember.id} />
                      <Button type="submit" variant="outline" size="sm" className="w-full">
                        <UserCheck className="size-4 mr-2" />
                        Start Health Tracking
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Legacy members (created before FamilyHub integration) */}
      {legacyMembers.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Legacy Members</h2>
            <p className="text-sm text-muted-foreground">
              These members were created before FamilyHub integration. Add them in FamilyHub to link their data.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {legacyMembers.map((member) => (
              <Link key={member.id} href={`/family/${member.id}`}>
                <Card className={`hover:bg-accent/50 transition-colors cursor-pointer h-full ${!member.isActive ? "opacity-50" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{member.firstName} {member.lastName}</CardTitle>
                      <Badge variant="secondary" className="text-xs">Legacy</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {member.relationship && `${member.relationship} · `}
                      {member.dateOfBirth
                        ? `${formatAge(member.dateOfBirth)} years old`
                        : "DOB not set"}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {member.healthProfiles.length > 0 ? (
                        <Badge variant="outline" className="text-xs">Profile</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">No profile</Badge>
                      )}
                      {member._count.medications > 0 && (
                        <Badge variant="outline" className="text-xs">{member._count.medications} meds</Badge>
                      )}
                      {member._count.appointments > 0 && (
                        <Badge variant="outline" className="text-xs">{member._count.appointments} appts</Badge>
                      )}
                      {member._count.vaccinations > 0 && (
                        <Badge variant="outline" className="text-xs">{member._count.vaccinations} vaccines</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
