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
import { UserPlus, Users, UserRoundPlus, Globe, ArrowRight, Star } from "lucide-react";
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

  const linkedMembers = members.filter((m) => m.linkedUserId && m.isActive);
  const standaloneMembers = members.filter((m) => !m.linkedUserId);

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

    const byHousehold = new Map<string, typeof otherMembers>();
    for (const m of otherMembers) {
      if (!byHousehold.has(m.householdId)) byHousehold.set(m.householdId, []);
      byHousehold.get(m.householdId)!.push(m);
    }

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
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">People</h1>
        <p className="text-muted-foreground text-sm">
          {members.length} contact{members.length !== 1 ? "s" : ""} &middot;{" "}
          {linkedMembers.length} household &middot; {standaloneMembers.length} other
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left column — member lists */}
        <div className="space-y-6 min-w-0">
          {/* Unlinked household members alert */}
          {unlinkedHouseholdMembers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Members not yet added to People
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {unlinkedHouseholdMembers.map((hm) => {
                    const isMe = user && hm.userId === user.id;
                    return (
                      <div key={hm.userId} className={`flex items-center justify-between rounded-lg border p-3 ${isMe ? "border-primary/40 bg-primary/5" : ""}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{hm.displayName}</p>
                            {isMe && <Badge variant="default" className="text-[9px]">You</Badge>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hm.familyRelationship && (
                              <Badge variant="secondary" className="text-[10px]">
                                {formatRelationship(hm.familyRelationship)}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground truncate">{hm.userEmail}</span>
                          </div>
                        </div>
                        <form action={syncHouseholdMemberAction}>
                          <input type="hidden" name="userId" value={hm.userId} />
                          <input type="hidden" name="displayName" value={hm.displayName} />
                          <input type="hidden" name="familyRelationship" value={hm.familyRelationship ?? "Other"} />
                          <Button type="submit" variant={isMe ? "default" : "outline"} size="sm" className="h-7 text-[10px] shrink-0 ml-2">
                            <UserPlus className="size-3 mr-1" />
                            {isMe ? "Add yourself" : "Add"}
                          </Button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Household Members */}
          {linkedMembers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Household Members</h2>
                <span className="text-xs text-muted-foreground">{linkedMembers.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {linkedMembers.map((member) => {
                  const isMe = user && member.linkedUserId === user.id;
                  return (
                    <Link key={member.id} href={`/people/${member.id}`}>
                      <Card className={`person-card cursor-pointer h-full ${!member.isActive ? "opacity-60" : ""} ${isMe ? "ring-1 ring-primary/30" : ""}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold truncate">
                                  {member.firstName} {member.lastName}
                                </p>
                                {isMe && <Badge className="text-[9px] bg-primary/15 text-primary border-0">You</Badge>}
                              </div>
                              {member.birthday && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatBirthday(member.birthday)}
                                  {formatAge(member.birthday) && ` (${formatAge(member.birthday)})`}
                                </p>
                              )}
                              {(member.phone || member.email) && (
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                  {member.phone || member.email}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant="default" className="text-[9px]">Household</Badge>
                              {(() => {
                                const rel = getDisplayRelationship(member.id, member.relationship, relativeMap);
                                return rel ? (
                                  <Badge variant="outline" className="text-[9px]">{formatRelationship(rel)}</Badge>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {unlinkedHouseholdMembers.length === 0 && linkedMembers.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No household members.{" "}
              <a href={`${process.env.AUTH_URL || "http://localhost:8080"}/households`} className="text-primary hover:underline">
                Add members in Family Manager
              </a>.
            </p>
          )}

          {/* Standalone Contacts */}
          {standaloneMembers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <UserRoundPlus className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Other Contacts</h2>
                <span className="text-xs text-muted-foreground">{standaloneMembers.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {standaloneMembers.map((member) => (
                  <Link key={member.id} href={`/people/${member.id}`}>
                    <Card className={`person-card cursor-pointer h-full ${!member.isActive ? "opacity-60" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {member.firstName} {member.lastName}
                            </p>
                            {member.birthday && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {formatBirthday(member.birthday)}
                                {formatAge(member.birthday) && ` (${formatAge(member.birthday)})`}
                              </p>
                            )}
                            {(member.phone || member.email) && (
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {member.phone || member.email}
                              </p>
                            )}
                            {member.city && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {[member.city, member.state].filter(Boolean).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {(() => {
                              const rel = getDisplayRelationship(member.id, member.relationship, relativeMap);
                              return rel ? (
                                <Badge variant="outline" className="text-[9px]">{formatRelationship(rel)}</Badge>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Cross-Household Family */}
          {crossHouseholdGroups.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Family from Other Households</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Connected via your family tree.{" "}
                <Link href="/family-tree/manage" className="text-primary hover:underline">
                  Manage connections
                </Link>
              </p>
              {crossHouseholdGroups.map((group) => (
                <div key={group.householdName} className="space-y-2 mb-4">
                  <Badge variant="secondary" className="text-purple-700 dark:text-purple-400 text-[10px]">
                    {group.householdName}
                  </Badge>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.members.map((member) => (
                      <Link key={member.id} href={`/people/${member.id}`}>
                        <Card className="person-card cursor-pointer h-full">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">
                                  {member.firstName} {member.lastName}
                                </p>
                                {member.birthday && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {formatBirthday(member.birthday)}
                                    {formatAge(member.birthday) && ` (${formatAge(member.birthday)})`}
                                  </p>
                                )}
                              </div>
                              {(() => {
                                const rel = relativeMap.get(member.id);
                                return rel ? (
                                  <Badge variant="outline" className="text-[9px]">{formatRelationship(rel)}</Badge>
                                ) : null;
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        {/* Right column — add person form */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserRoundPlus className="size-4" />
                Add a Person
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createFamilyMemberAction} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="firstName" className="text-xs">First Name *</Label>
                    <Input id="firstName" name="firstName" required className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName" className="text-xs">Last Name *</Label>
                    <Input id="lastName" name="lastName" required className="h-8 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nickname" className="text-xs">Nickname</Label>
                  <Input id="nickname" name="nickname" className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="birthday" className="text-xs">Birthday</Label>
                    <Input id="birthday" name="birthday" type="date" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="anniversary" className="text-xs">Anniversary</Label>
                    <Input id="anniversary" name="anniversary" type="date" className="h-8 text-sm" />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="phone" className="text-xs">Phone</Label>
                    <Input id="phone" name="phone" type="tel" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-xs">Email</Label>
                    <Input id="email" name="email" type="email" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="preferredContactMethod" className="text-xs">Preferred Contact</Label>
                  <select
                    id="preferredContactMethod"
                    name="preferredContactMethod"
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {CONTACT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <Separator />

                <div className="space-y-1">
                  <Label htmlFor="addressLine1" className="text-xs">Address</Label>
                  <Input id="addressLine1" name="addressLine1" placeholder="Line 1" className="h-8 text-sm" />
                </div>
                <Input name="addressLine2" placeholder="Line 2" className="h-8 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Input name="city" placeholder="City" className="h-8 text-sm" />
                  <Input name="state" placeholder="State" className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="zipCode" placeholder="Zip" className="h-8 text-sm" />
                  <Input name="country" placeholder="Country" className="h-8 text-sm" />
                </div>

                <Separator />

                <div className="space-y-1">
                  <Label htmlFor="notes" className="text-xs">Notes</Label>
                  <Textarea id="notes" name="notes" rows={2} className="text-sm" />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="includeInHolidayCards" name="includeInHolidayCards" />
                  <Label htmlFor="includeInHolidayCards" className="text-xs font-normal">Include in holiday card list</Label>
                </div>

                <Button type="submit" className="w-full h-9">
                  <UserPlus className="size-4 mr-1.5" />
                  Add Person
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
