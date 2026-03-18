import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatAge, formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { updateFamilyMemberAction, toggleFamilyMemberActiveAction } from "../actions";

export default async function FamilyMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const member = await prisma.familyMember.findUnique({
    where: { id, householdId },
    include: {
      healthProfile: true,
      medications: { where: { isActive: true }, orderBy: { medicationName: "asc" } },
      appointments: { where: { status: "SCHEDULED" }, orderBy: { appointmentDateTime: "asc" }, take: 5, include: { provider: true } },
      vaccinations: { orderBy: { dateAdministered: "desc" }, take: 5 },
      emergencyContacts: { orderBy: { priority: "asc" } },
      insurances: { where: { isActive: true } },
    },
  });
  if (!member) notFound();

  const dobStr = member.dateOfBirth?.toISOString().split("T")[0] ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/family"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{member.firstName} {member.lastName}</h1>
          <p className="text-muted-foreground">
            {member.relationship && `${member.relationship} · `}
            {member.dateOfBirth
              ? `${formatAge(member.dateOfBirth)} years old · Born ${formatDate(member.dateOfBirth)}`
              : "Date of birth not set"}
          </p>
        </div>
        <form action={toggleFamilyMemberActiveAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="isActive" value={String(member.isActive)} />
          <Button type="submit" variant="outline" size="sm">
            {member.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </form>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader><CardTitle>Edit Details</CardTitle></CardHeader>
        <CardContent>
          <form action={updateFamilyMemberAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <input type="hidden" name="id" value={id} />
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input name="firstName" defaultValue={member.firstName} required />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input name="lastName" defaultValue={member.lastName} required />
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input name="dateOfBirth" type="date" defaultValue={dobStr} />
            </div>
            <div className="space-y-1">
              <Label>Relationship</Label>
              <Select name="relationship" defaultValue={member.relationship || ""}>
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
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      {/* Health Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Health Profile</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/profiles?memberId=${id}`}>
                {member.healthProfile ? "Edit Profile" : "Create Profile"}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {member.healthProfile ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Blood Type</div>
                <div className="text-sm font-medium">{member.healthProfile.bloodType.replace(/_/g, " ")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Height / Weight</div>
                <div className="text-sm font-medium">
                  {member.healthProfile.heightCm ? `${Number(member.healthProfile.heightCm)} cm` : "—"}
                  {" / "}
                  {member.healthProfile.weightKg ? `${Number(member.healthProfile.weightKg)} kg` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Organ Donor</div>
                <div className="text-sm font-medium">{member.healthProfile.isOrganDonor ? "Yes" : "No"}</div>
              </div>
              {member.healthProfile.allergies.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs text-muted-foreground mb-1">Allergies</div>
                  <div className="flex flex-wrap gap-1">
                    {member.healthProfile.allergies.map((a) => (
                      <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {member.healthProfile.chronicConditions.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs text-muted-foreground mb-1">Chronic Conditions</div>
                  <div className="flex flex-wrap gap-1">
                    {member.healthProfile.chronicConditions.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No health profile yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Medications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Medications</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/medications?memberId=${id}`}>View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {member.medications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No active medications</p>
            ) : (
              <div className="space-y-2">
                {member.medications.map((med) => (
                  <div key={med.id} className="flex justify-between text-sm">
                    <span className="font-medium">{med.medicationName}</span>
                    <span className="text-muted-foreground">{med.dosage} · {med.frequency}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Upcoming Appointments</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/appointments?memberId=${id}`}>View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {member.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No upcoming appointments</p>
            ) : (
              <div className="space-y-2">
                {member.appointments.map((appt) => (
                  <div key={appt.id} className="flex justify-between text-sm">
                    <span className="font-medium">{appt.appointmentType.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{formatDate(appt.appointmentDateTime)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Vaccinations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Vaccinations</CardTitle>
          </CardHeader>
          <CardContent>
            {member.vaccinations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No vaccinations recorded</p>
            ) : (
              <div className="space-y-2">
                {member.vaccinations.map((vax) => (
                  <div key={vax.id} className="flex justify-between text-sm">
                    <span className="font-medium">{vax.vaccineName}</span>
                    <span className="text-muted-foreground">{formatDate(vax.dateAdministered)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contacts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Emergency Contacts</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/emergency-contacts?memberId=${id}`}>Manage</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {member.emergencyContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No emergency contacts</p>
            ) : (
              <div className="space-y-2">
                {member.emergencyContacts.map((ec) => (
                  <div key={ec.id} className="flex justify-between text-sm">
                    <span className="font-medium">{ec.name} ({ec.relationship})</span>
                    <span className="text-muted-foreground">{ec.phoneNumber}</span>
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
