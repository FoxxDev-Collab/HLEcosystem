import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertHealthProfileAction } from "./actions";

const BLOOD_TYPES = [
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE", "UNKNOWN",
];

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const members = await prisma.familyMember.findMany({
    where: { householdId, isActive: true },
    include: { healthProfile: true },
    orderBy: { firstName: "asc" },
  });

  const selectedMemberId = params.memberId || members[0]?.id;
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const profile = selectedMember?.healthProfile;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Health Profiles</h1>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Add family members first to create health profiles.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Member Selector */}
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <a key={m.id} href={`/profiles?memberId=${m.id}`}>
                <Badge
                  variant={m.id === selectedMemberId ? "default" : "outline"}
                  className="cursor-pointer py-1.5 px-3"
                >
                  {m.firstName} {m.lastName}
                  {m.healthProfile ? " ✓" : ""}
                </Badge>
              </a>
            ))}
          </div>

          {/* Profile Form */}
          {selectedMember && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedMember.firstName}&apos;s Health Profile</CardTitle>
                <CardDescription>
                  {profile ? "Edit health information" : "Create a new health profile"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={upsertHealthProfileAction} className="space-y-6">
                  <input type="hidden" name="familyMemberId" value={selectedMember.id} />

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Blood Type</Label>
                      <Select name="bloodType" defaultValue={profile?.bloodType || "UNKNOWN"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BLOOD_TYPES.map((bt) => (
                            <SelectItem key={bt} value={bt}>{bt.replace(/_/g, " ").replace("POSITIVE", "+").replace("NEGATIVE", "-")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Height (cm)</Label>
                      <Input name="heightCm" type="number" step="0.01" defaultValue={profile?.heightCm ? Number(profile.heightCm) : ""} />
                    </div>
                    <div className="space-y-1">
                      <Label>Weight (kg)</Label>
                      <Input name="weightKg" type="number" step="0.01" defaultValue={profile?.weightKg ? Number(profile.weightKg) : ""} />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input type="checkbox" name="isOrganDonor" id="isOrganDonor" defaultChecked={profile?.isOrganDonor} className="size-4" />
                      <Label htmlFor="isOrganDonor">Organ Donor</Label>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Primary Care Provider</Label>
                      <Input name="primaryCareProvider" defaultValue={profile?.primaryCareProvider || ""} placeholder="Dr. Smith" />
                    </div>
                    <div className="space-y-1">
                      <Label>Preferred Hospital</Label>
                      <Input name="preferredHospital" defaultValue={profile?.preferredHospital || ""} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Allergies (comma-separated)</Label>
                    <Input name="allergies" defaultValue={profile?.allergies.join(", ") || ""} placeholder="Penicillin, Peanuts, Shellfish" />
                  </div>

                  <div className="space-y-1">
                    <Label>Chronic Conditions (comma-separated)</Label>
                    <Input name="chronicConditions" defaultValue={profile?.chronicConditions.join(", ") || ""} placeholder="Asthma, Diabetes" />
                  </div>

                  <div className="space-y-1">
                    <Label>Major Surgeries (comma-separated)</Label>
                    <Input name="majorSurgeries" defaultValue={profile?.majorSurgeries.join(", ") || ""} placeholder="Appendectomy 2020" />
                  </div>

                  <div className="space-y-1">
                    <Label>Medical Notes</Label>
                    <Textarea name="medicalNotes" defaultValue={profile?.medicalNotes || ""} rows={3} />
                  </div>

                  <Button type="submit">{profile ? "Update Profile" : "Create Profile"}</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
