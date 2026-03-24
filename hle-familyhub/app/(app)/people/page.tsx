import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdMembersWithRelationships, getHouseholdById } from "@/lib/household";
import { formatRelationship } from "@/lib/relationships";
import { getRelativeRelationships, getDisplayRelationship } from "@/lib/relative-relationships";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Users, UserRoundPlus, Globe } from "lucide-react";
import { createFamilyMemberAction, toggleActiveMemberAction, syncHouseholdMemberAction } from "./actions";

const CONTACT_METHODS = ["NONE", "PHONE", "EMAIL", "TEXT"];

function formatAge(birthday: Date | null): string | null {
  if (!birthday) return null;
  const today = new Date();
  const b = new Date(birthday);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return `Age ${age}`;
}

function formatBirthday(birthday: Date | null): string {
  if (!birthday) return "";
  return new Date(birthday).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function PeoplePage() {
  const householdId = (await getCurrentHouseholdId())!;
  const user = await getCurrentUser();

  // Current household data
  const [members, householdMembers, relativeMap] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId },
      orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
    }),
    getHouseholdMembersWithRelationships(householdId),
    user ? getRelativeRelationships(householdId, user.id) : Promise.resolve(new Map()),
  ]);

  const linkedUserIds = new Set(
    members.filter((m) => m.linkedUserId).map((m) => m.linkedUserId!)
  );

  const unlinkedHouseholdMembers = householdMembers.filter(
    (hm) => !linkedUserIds.has(hm.userId)
  );

  const linkedMembers = members.filter((m) => m.linkedUserId);
  const standaloneMembers = members.filter((m) => !m.linkedUserId);

  // Discover cross-household members via relationships
  const currentRelations = await prisma.familyRelation.findMany({
    where: { householdId },
    select: { fromMemberId: true, toMemberId: true },
  });

  const currentMemberIds = new Set(members.map((m) => m.id));
  const otherMemberIds = new Set<string>();
  for (const r of currentRelations) {
    if (!currentMemberIds.has(r.fromMemberId)) otherMemberIds.add(r.fromMemberId);
    if (!currentMemberIds.has(r.toMemberId)) otherMemberIds.add(r.toMemberId);
  }

  // Fetch cross-household members and group by household
  type CrossHouseholdGroup = {
    householdName: string;
    members: typeof members;
  };
  const crossHouseholdGroups: CrossHouseholdGroup[] = [];

  if (otherMemberIds.size > 0) {
    const otherMembers = await prisma.familyMember.findMany({
      where: { id: { in: [...otherMemberIds] }, isActive: true },
      orderBy: { firstName: "asc" },
    });

    // Group by household
    const byHousehold = new Map<string, typeof otherMembers>();
    for (const m of otherMembers) {
      if (!byHousehold.has(m.householdId)) byHousehold.set(m.householdId, []);
      byHousehold.get(m.householdId)!.push(m);
    }

    // Fetch household names
    const otherHouseholdIds = [...byHousehold.keys()];
    const households = await Promise.all(otherHouseholdIds.map((id) => getHouseholdById(id)));
    for (const h of households) {
      if (h && byHousehold.has(h.id)) {
        crossHouseholdGroups.push({
          householdName: h.name,
          members: byHousehold.get(h.id)!,
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">People</h1>

      {/* Household Members Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Household Members</h2>
        </div>

        {unlinkedHouseholdMembers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Members not yet added to People
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unlinkedHouseholdMembers.map((hm) => (
                  <div key={hm.userId} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{hm.displayName}</p>
                      <div className="flex items-center gap-1.5">
                        {hm.familyRelationship && (
                          <Badge variant="secondary" className="text-xs">
                            {formatRelationship(hm.familyRelationship)}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{hm.userEmail}</span>
                      </div>
                    </div>
                    <form action={syncHouseholdMemberAction}>
                      <input type="hidden" name="userId" value={hm.userId} />
                      <input type="hidden" name="displayName" value={hm.displayName} />
                      <input type="hidden" name="familyRelationship" value={hm.familyRelationship ?? "Other"} />
                      <Button type="submit" variant="outline" size="sm">
                        <UserPlus className="size-3.5 mr-1" />
                        Add Details
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {linkedMembers.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {linkedMembers.map((member) => (
              <Card key={member.id} className={!member.isActive ? "opacity-60" : ""}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/people/${member.id}`} className="font-semibold hover:underline">
                        {member.firstName} {member.lastName}
                      </Link>
                      <div className="flex items-center gap-1">
                        <Badge variant="default" className="text-xs">Household</Badge>
                        {(() => {
                          const rel = getDisplayRelationship(member.id, member.relationship, relativeMap);
                          return rel ? (
                            <Badge variant="outline">{formatRelationship(rel)}</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <Link href="/family-tree/manage" className="hover:underline">Define relationship</Link>
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>
                    {member.birthday && (
                      <p className="text-sm text-muted-foreground">
                        {formatBirthday(member.birthday)}
                        {formatAge(member.birthday) && ` (${formatAge(member.birthday)})`}
                      </p>
                    )}
                    {(member.phone || member.email) && (
                      <p className="text-sm text-muted-foreground">
                        {member.phone && <span>{member.phone}</span>}
                        {member.phone && member.email && <span> | </span>}
                        {member.email && <span>{member.email}</span>}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/people/${member.id}`}>Details</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {unlinkedHouseholdMembers.length === 0 && linkedMembers.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            No other household members. Add members in{" "}
            <a href="http://localhost:8080/households" className="text-primary hover:underline">
              Family Manager
            </a>.
          </p>
        )}
      </div>

      <Separator />

      {/* Other Contacts Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserRoundPlus className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Other Contacts</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add a Person</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createFamilyMemberAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" name="firstName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" name="lastName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input id="nickname" name="nickname" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthday">Birthday</Label>
                  <Input id="birthday" name="birthday" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anniversary">Anniversary</Label>
                  <Input id="anniversary" name="anniversary" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredContactMethod">Preferred Contact</Label>
                  <select id="preferredContactMethod" name="preferredContactMethod" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {CONTACT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1</Label>
                  <Input id="addressLine1" name="addressLine1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input id="addressLine2" name="addressLine2" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input id="zipCode" name="zipCode" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" name="country" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="includeInHolidayCards" name="includeInHolidayCards" />
                <Label htmlFor="includeInHolidayCards" className="text-sm font-normal">Include in holiday card list</Label>
              </div>

              <Button type="submit">Add Person</Button>
            </form>
          </CardContent>
        </Card>

        {standaloneMembers.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {standaloneMembers.map((member) => (
              <Card key={member.id} className={!member.isActive ? "opacity-60" : ""}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/people/${member.id}`} className="font-semibold hover:underline">
                        {member.firstName} {member.lastName}
                      </Link>
                      {(() => {
                        const rel = getDisplayRelationship(member.id, member.relationship, relativeMap);
                        return rel ? (
                          <Badge variant="outline">{formatRelationship(rel)}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Link href="/family-tree/manage" className="hover:underline">Define relationship</Link>
                          </Badge>
                        );
                      })()}
                    </div>
                    {member.birthday && (
                      <p className="text-sm text-muted-foreground">
                        {formatBirthday(member.birthday)}
                        {formatAge(member.birthday) && ` (${formatAge(member.birthday)})`}
                      </p>
                    )}
                    {(member.phone || member.email) && (
                      <p className="text-sm text-muted-foreground">
                        {member.phone && <span>{member.phone}</span>}
                        {member.phone && member.email && <span> | </span>}
                        {member.email && <span>{member.email}</span>}
                      </p>
                    )}
                    {member.city && (
                      <p className="text-sm text-muted-foreground">
                        {[member.city, member.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <form action={toggleActiveMemberAction}>
                        <input type="hidden" name="id" value={member.id} />
                        <Button type="submit" variant="outline" size="sm">
                          {member.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/people/${member.id}`}>Details</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cross-Household Family Section */}
      {crossHouseholdGroups.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Family from Other Households</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              People from other households connected via your family tree.{" "}
              <Link href="/family-tree/manage" className="text-primary hover:underline">
                Manage connections
              </Link>{" "}
              to add more.
            </p>

            {crossHouseholdGroups.map((group) => (
              <div key={group.householdName} className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="secondary" className="text-purple-700 dark:text-purple-400">
                    {group.householdName}
                  </Badge>
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.members.map((member) => (
                    <Card key={member.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Link href={`/people/${member.id}`} className="font-semibold hover:underline">
                              {member.firstName} {member.lastName}
                            </Link>
                            {(() => {
                              const rel = relativeMap.get(member.id);
                              return rel ? (
                                <Badge variant="outline">{formatRelationship(rel)}</Badge>
                              ) : null;
                            })()}
                          </div>
                          {member.birthday && (
                            <p className="text-sm text-muted-foreground">
                              {formatBirthday(member.birthday)}
                              {formatAge(member.birthday) && ` (${formatAge(member.birthday)})`}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-2">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/people/${member.id}`}>Details</Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
