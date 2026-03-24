import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
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
import { formatDate, formatCurrency } from "@/lib/format";
import { updateFamilyMemberAction, deleteFamilyMemberAction } from "../actions";

const CONTACT_METHODS = ["NONE", "PHONE", "EMAIL", "TEXT"];

const STATUS_COLORS: Record<string, string> = {
  IDEA: "bg-gray-100 text-gray-700",
  PURCHASED: "bg-blue-100 text-blue-700",
  WRAPPED: "bg-yellow-100 text-yellow-700",
  GIVEN: "bg-green-100 text-green-700",
};

const DATE_TYPE_COLORS: Record<string, string> = {
  BIRTHDAY: "bg-blue-100 text-blue-700",
  ANNIVERSARY: "bg-pink-100 text-pink-700",
  GRADUATION: "bg-purple-100 text-purple-700",
  MEMORIAL: "bg-gray-100 text-gray-700",
  HOLIDAY: "bg-green-100 text-green-700",
  CUSTOM: "bg-orange-100 text-orange-700",
};

function formatDateInput(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

export default async function FamilyMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const householdId = (await getCurrentHouseholdId())!;
  const user = await getCurrentUser();

  const [member, connections] = await Promise.all([
    prisma.familyMember.findUnique({
      where: { id, householdId },
      include: {
        importantDates: { orderBy: { date: "asc" } },
        gifts: { orderBy: { createdAt: "desc" } },
        giftIdeas: { where: { status: "ACTIVE" }, orderBy: { priority: "desc" } },
      },
    }),
    prisma.familyRelation.findMany({
      where: { fromMemberId: id },
      include: {
        toMember: { select: { id: true, firstName: true, lastName: true, householdId: true } },
      },
    }),
  ]);

  if (!member) notFound();

  const relativeMap = user
    ? await getRelativeRelationships(householdId, user.id)
    : new Map();

  const displayRel = getDisplayRelationship(member.id, member.relationship, relativeMap);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{member.firstName} {member.lastName}</h1>
        {member.linkedUserId && <Badge variant="default" className="text-xs">Household Member</Badge>}
        {displayRel ? (
          <Badge variant="outline">{formatRelationship(displayRel)}</Badge>
        ) : (
          <Badge variant="secondary">No relationship defined</Badge>
        )}
        {!member.isActive && <Badge variant="secondary">Inactive</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateFamilyMemberAction} className="space-y-4">
            <input type="hidden" name="id" value={member.id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" name="firstName" defaultValue={member.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" name="lastName" defaultValue={member.lastName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname</Label>
                <Input id="nickname" name="nickname" defaultValue={member.nickname ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthday">Birthday</Label>
                <Input id="birthday" name="birthday" type="date" defaultValue={formatDateInput(member.birthday)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anniversary">Anniversary</Label>
                <Input id="anniversary" name="anniversary" type="date" defaultValue={formatDateInput(member.anniversary)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" defaultValue={member.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={member.email ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredContactMethod">Preferred Contact</Label>
                <select id="preferredContactMethod" name="preferredContactMethod" defaultValue={member.preferredContactMethod} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
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
                <Input id="addressLine1" name="addressLine1" defaultValue={member.addressLine1 ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" name="addressLine2" defaultValue={member.addressLine2 ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={member.city ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" defaultValue={member.state ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input id="zipCode" name="zipCode" defaultValue={member.zipCode ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" defaultValue={member.country ?? ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationshipNotes">Relationship Notes</Label>
              <Textarea id="relationshipNotes" name="relationshipNotes" rows={2} defaultValue={member.relationshipNotes ?? ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={member.notes ?? ""} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="includeInHolidayCards" name="includeInHolidayCards" defaultChecked={member.includeInHolidayCards} />
              <Label htmlFor="includeInHolidayCards" className="text-sm font-normal">Include in holiday card list</Label>
            </div>

            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
        </CardHeader>
        <CardContent>
          {connections.length > 0 ? (
            <div className="space-y-2 mb-4">
              {connections.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {formatRelationship(r.relationType)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">of</span>
                    <Link href={`/people/${r.toMember.id}`} className="text-sm font-medium hover:underline">
                      {r.toMember.firstName} {r.toMember.lastName}
                    </Link>
                    {r.toMember.householdId !== householdId && (
                      <Badge variant="secondary" className="text-[10px] text-purple-700 dark:text-purple-400">Other Household</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              No connections defined yet. Use Manage Connections to define how this person is related to others.
            </p>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/family-tree/manage">Manage Connections</Link>
          </Button>
        </CardContent>
      </Card>

      {member.importantDates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Important Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {member.importantDates.map((d) => (
                <div key={d.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                  </div>
                  <Badge className={DATE_TYPE_COLORS[d.type]}>{d.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {member.gifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gift History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {member.gifts.map((g) => (
                <div key={g.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{g.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.occasion && `${g.occasion} - `}
                      {g.actualCost ? formatCurrency(g.actualCost.toString()) : g.estimatedCost ? `~${formatCurrency(g.estimatedCost.toString())}` : ""}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[g.status]}>{g.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {member.giftIdeas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gift Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {member.giftIdeas.map((gi) => (
                <div key={gi.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{gi.idea}</p>
                    <p className="text-xs text-muted-foreground">
                      {gi.estimatedCost ? formatCurrency(gi.estimatedCost.toString()) : ""}
                      {gi.source && ` - From: ${gi.source}`}
                    </p>
                  </div>
                  <Badge variant={gi.priority === "HIGH" ? "destructive" : gi.priority === "MEDIUM" ? "default" : "secondary"}>
                    {gi.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={deleteFamilyMemberAction}>
            <input type="hidden" name="id" value={member.id} />
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete this family member and all associated data.
            </p>
            <Button type="submit" variant="destructive">Delete Member</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
