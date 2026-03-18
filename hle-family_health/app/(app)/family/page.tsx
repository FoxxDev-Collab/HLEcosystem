import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatAge, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createFamilyMemberAction } from "./actions";

export default async function FamilyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const members = await prisma.familyMember.findMany({
    where: { householdId },
    include: {
      healthProfile: true,
      _count: { select: { medications: { where: { isActive: true } }, appointments: true, vaccinations: true } },
    },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Family Members</h1>

      {/* Add Member */}
      <Card>
        <CardHeader><CardTitle>Add Family Member</CardTitle></CardHeader>
        <CardContent>
          <form action={createFamilyMemberAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input name="firstName" required />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input name="lastName" required />
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input name="dateOfBirth" type="date" required />
            </div>
            <div className="space-y-1">
              <Label>Relationship</Label>
              <Select name="relationship">
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Self">Self</SelectItem>
                  <SelectItem value="Spouse">Spouse</SelectItem>
                  <SelectItem value="Child">Child</SelectItem>
                  <SelectItem value="Parent">Parent</SelectItem>
                  <SelectItem value="Sibling">Sibling</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Member</Button>
          </form>
        </CardContent>
      </Card>

      {/* Members List */}
      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No family members yet. Add one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Link key={member.id} href={`/family/${member.id}`}>
              <Card className={`hover:bg-accent/50 transition-colors cursor-pointer h-full ${!member.isActive ? "opacity-50" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{member.firstName} {member.lastName}</CardTitle>
                    {!member.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {member.relationship && `${member.relationship} · `}
                    {member.dateOfBirth
                      ? `${formatAge(member.dateOfBirth)} years old`
                      : "DOB not set"}
                    {member.gender && ` · ${member.gender}`}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {member.linkedUserId && (
                      <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Synced</Badge>
                    )}
                    {!member.dateOfBirth && (
                      <Badge variant="secondary" className="text-xs text-amber-700">DOB needed</Badge>
                    )}
                    {member.healthProfile ? (
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
      )}
    </div>
  );
}
