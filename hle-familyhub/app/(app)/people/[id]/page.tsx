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
import {
  ArrowLeft, MapPin, Briefcase, Calendar, Gift, Lightbulb, Link2,
  Trash2, Plus, Building2, Home,
} from "lucide-react";
import {
  updateFamilyMemberAction,
  deleteFamilyMemberAction,
  addAddressAction,
  deleteAddressAction,
  addCareerEntryAction,
  deleteCareerEntryAction,
} from "../actions";

const CONTACT_METHODS = ["NONE", "PHONE", "EMAIL", "TEXT"];

const STATUS_COLORS: Record<string, string> = {
  IDEA: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PURCHASED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  WRAPPED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  GIVEN: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const DATE_TYPE_COLORS: Record<string, string> = {
  BIRTHDAY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ANNIVERSARY: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  GRADUATION: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  MEMORIAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  HOLIDAY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  CUSTOM: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

function formatDateInput(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

function formatAge(birthday: Date | null): string | null {
  if (!birthday) return null;
  const today = new Date();
  const b = new Date(birthday);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return `${age}`;
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
        addresses: { orderBy: [{ isCurrent: "desc" }, { moveInDate: "desc" }] },
        careerEntries: { orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }] },
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
  const isMe = user && member.linkedUserId === user.id;
  const age = formatAge(member.birthday);
  const currentAddress = member.addresses.find((a) => a.isCurrent);
  const previousAddresses = member.addresses.filter((a) => !a.isCurrent);
  const currentJob = member.careerEntries.find((c) => c.isCurrent);
  const previousJobs = member.careerEntries.filter((c) => !c.isCurrent);

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/people">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isMe ? "Your Profile" : `${member.firstName} ${member.lastName}`}
            </h1>
            {isMe && <Badge className="text-[10px] bg-primary/15 text-primary border-0">You</Badge>}
            {member.linkedUserId && !isMe && <Badge variant="default" className="text-[10px]">Household</Badge>}
            {!member.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {isMe && <span className="text-sm text-muted-foreground">{member.firstName} {member.lastName}</span>}
            {displayRel && (
              <Badge variant="outline" className="text-[10px]">{formatRelationship(displayRel)}</Badge>
            )}
            {age && (
              <span className="text-xs text-muted-foreground">Age {age}</span>
            )}
            {currentJob && (
              <span className="text-xs text-muted-foreground">
                {currentJob.title ? `${currentJob.title} at ${currentJob.employer}` : currentJob.employer}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left column — profile data */}
        <div className="space-y-6 min-w-0">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {isMe ? "Your Details" : "Personal Details"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateFamilyMemberAction} className="space-y-4">
                <input type="hidden" name="id" value={member.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs">First Name *</Label>
                    <Input id="firstName" name="firstName" defaultValue={member.firstName} required className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs">Last Name *</Label>
                    <Input id="lastName" name="lastName" defaultValue={member.lastName} required className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nickname" className="text-xs">Nickname</Label>
                    <Input id="nickname" name="nickname" defaultValue={member.nickname ?? ""} className="h-9" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="birthday" className="text-xs">Birthday</Label>
                    <Input id="birthday" name="birthday" type="date" defaultValue={formatDateInput(member.birthday)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="anniversary" className="text-xs">Wedding Anniversary</Label>
                    <Input id="anniversary" name="anniversary" type="date" defaultValue={formatDateInput(member.anniversary)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="preferredContactMethod" className="text-xs">Preferred Contact</Label>
                    <select id="preferredContactMethod" name="preferredContactMethod" defaultValue={member.preferredContactMethod} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      {CONTACT_METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs">Phone</Label>
                    <Input id="phone" name="phone" type="tel" defaultValue={member.phone ?? ""} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={member.email ?? ""} className="h-9" />
                  </div>
                </div>

                <Separator />

                {/* Inline address fields (current address shortcut) */}
                <p className="text-xs text-muted-foreground">Quick address (also managed in Address History below)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="addressLine1" className="text-xs">Address Line 1</Label>
                    <Input id="addressLine1" name="addressLine1" defaultValue={member.addressLine1 ?? ""} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="addressLine2" className="text-xs">Address Line 2</Label>
                    <Input id="addressLine2" name="addressLine2" defaultValue={member.addressLine2 ?? ""} className="h-9" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Input name="city" placeholder="City" defaultValue={member.city ?? ""} className="h-9" />
                  <Input name="state" placeholder="State" defaultValue={member.state ?? ""} className="h-9" />
                  <Input name="zipCode" placeholder="Zip" defaultValue={member.zipCode ?? ""} className="h-9" />
                  <Input name="country" placeholder="Country" defaultValue={member.country ?? ""} className="h-9" />
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="relationshipNotes" className="text-xs">Relationship Notes</Label>
                  <Textarea id="relationshipNotes" name="relationshipNotes" rows={2} defaultValue={member.relationshipNotes ?? ""} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs">Notes</Label>
                  <Textarea id="notes" name="notes" rows={2} defaultValue={member.notes ?? ""} className="text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="includeInHolidayCards" name="includeInHolidayCards" defaultChecked={member.includeInHolidayCards} />
                  <Label htmlFor="includeInHolidayCards" className="text-xs font-normal">Include in holiday card list</Label>
                </div>

                <Button type="submit" size="sm" className="h-9">Save Changes</Button>
              </form>
            </CardContent>
          </Card>

          {/* Address History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="size-4" />
                Address History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current address */}
              {currentAddress && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Home className="size-3 text-primary" />
                        <span className="text-xs font-semibold">Current</span>
                        {currentAddress.label && <Badge variant="outline" className="text-[9px]">{currentAddress.label}</Badge>}
                      </div>
                      <p className="text-sm">{currentAddress.addressLine1}</p>
                      {currentAddress.addressLine2 && <p className="text-sm">{currentAddress.addressLine2}</p>}
                      <p className="text-sm">
                        {[currentAddress.city, currentAddress.state, currentAddress.zipCode].filter(Boolean).join(", ")}
                        {currentAddress.country && ` ${currentAddress.country}`}
                      </p>
                      {currentAddress.moveInDate && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Since {formatDate(currentAddress.moveInDate)}
                        </p>
                      )}
                    </div>
                    <form action={deleteAddressAction}>
                      <input type="hidden" name="id" value={currentAddress.id} />
                      <input type="hidden" name="familyMemberId" value={member.id} />
                      <Button type="submit" variant="ghost" size="sm" className="h-7 text-[10px] text-destructive">
                        <Trash2 className="size-3" />
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {/* Previous addresses */}
              {previousAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Previous</p>
                  {previousAddresses.map((addr) => (
                    <div key={addr.id} className="rounded-lg border border-dashed p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          {addr.label && <Badge variant="outline" className="text-[9px] mb-1">{addr.label}</Badge>}
                          <p className="text-sm text-muted-foreground">{addr.addressLine1}</p>
                          {addr.addressLine2 && <p className="text-sm text-muted-foreground">{addr.addressLine2}</p>}
                          <p className="text-sm text-muted-foreground">
                            {[addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ")}
                          </p>
                          {(addr.moveInDate || addr.moveOutDate) && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {addr.moveInDate && formatDate(addr.moveInDate)}
                              {addr.moveInDate && addr.moveOutDate && " — "}
                              {addr.moveOutDate && formatDate(addr.moveOutDate)}
                            </p>
                          )}
                        </div>
                        <form action={deleteAddressAction}>
                          <input type="hidden" name="id" value={addr.id} />
                          <input type="hidden" name="familyMemberId" value={member.id} />
                          <Button type="submit" variant="ghost" size="sm" className="h-7 text-[10px] text-destructive">
                            <Trash2 className="size-3" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add address form */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="size-3" /> Add address
                </summary>
                <form action={addAddressAction} className="mt-3 space-y-3 rounded-lg border p-3">
                  <input type="hidden" name="familyMemberId" value={member.id} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input name="label" placeholder="e.g. College, First apartment" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Address Line 1 *</Label>
                      <Input name="addressLine1" required className="h-8 text-sm" />
                    </div>
                  </div>
                  <Input name="addressLine2" placeholder="Address Line 2" className="h-8 text-sm" />
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Input name="city" placeholder="City" required className="h-8 text-sm" />
                    <Input name="state" placeholder="State" className="h-8 text-sm" />
                    <Input name="zipCode" placeholder="Zip" className="h-8 text-sm" />
                    <Input name="country" placeholder="Country" className="h-8 text-sm" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Move-in Date</Label>
                      <Input name="moveInDate" type="date" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Move-out Date</Label>
                      <Input name="moveOutDate" type="date" className="h-8 text-sm" />
                    </div>
                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Checkbox id="addr-isCurrent" name="isCurrent" />
                        <Label htmlFor="addr-isCurrent" className="text-xs font-normal">Current address</Label>
                      </div>
                    </div>
                  </div>
                  <Textarea name="notes" placeholder="Notes" rows={1} className="text-sm" />
                  <Button type="submit" size="sm" className="h-8">
                    <Plus className="size-3 mr-1" /> Add Address
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>

          {/* Career History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="size-4" />
                Career History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current job */}
              {currentJob && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="size-3 text-primary" />
                        <span className="text-xs font-semibold">Current Position</span>
                      </div>
                      <p className="text-sm font-medium">{currentJob.title || "Employee"}</p>
                      <p className="text-sm text-muted-foreground">{currentJob.employer}</p>
                      {currentJob.department && <p className="text-xs text-muted-foreground">{currentJob.department}</p>}
                      {currentJob.location && <p className="text-xs text-muted-foreground">{currentJob.location}</p>}
                      {currentJob.startDate && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Since {formatDate(currentJob.startDate)}
                        </p>
                      )}
                      {currentJob.notes && <p className="text-xs text-muted-foreground mt-1">{currentJob.notes}</p>}
                    </div>
                    <form action={deleteCareerEntryAction}>
                      <input type="hidden" name="id" value={currentJob.id} />
                      <input type="hidden" name="familyMemberId" value={member.id} />
                      <Button type="submit" variant="ghost" size="sm" className="h-7 text-[10px] text-destructive">
                        <Trash2 className="size-3" />
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {/* Previous jobs */}
              {previousJobs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Previous</p>
                  {previousJobs.map((job) => (
                    <div key={job.id} className="rounded-lg border border-dashed p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{job.title || "Employee"}</p>
                          <p className="text-sm text-muted-foreground">{job.employer}</p>
                          {job.department && <p className="text-xs text-muted-foreground">{job.department}</p>}
                          {job.location && <p className="text-xs text-muted-foreground">{job.location}</p>}
                          {(job.startDate || job.endDate) && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {job.startDate && formatDate(job.startDate)}
                              {job.startDate && job.endDate && " — "}
                              {job.endDate && formatDate(job.endDate)}
                            </p>
                          )}
                          {job.notes && <p className="text-xs text-muted-foreground mt-1">{job.notes}</p>}
                        </div>
                        <form action={deleteCareerEntryAction}>
                          <input type="hidden" name="id" value={job.id} />
                          <input type="hidden" name="familyMemberId" value={member.id} />
                          <Button type="submit" variant="ghost" size="sm" className="h-7 text-[10px] text-destructive">
                            <Trash2 className="size-3" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add career form */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="size-3" /> Add position
                </summary>
                <form action={addCareerEntryAction} className="mt-3 space-y-3 rounded-lg border p-3">
                  <input type="hidden" name="familyMemberId" value={member.id} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Employer *</Label>
                      <Input name="employer" required className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Job Title</Label>
                      <Input name="title" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Department</Label>
                      <Input name="department" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Location</Label>
                      <Input name="location" placeholder="e.g. Remote, Fort Meade, MD" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Input name="startDate" type="date" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Input name="endDate" type="date" className="h-8 text-sm" />
                    </div>
                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Checkbox id="career-isCurrent" name="isCurrent" />
                        <Label htmlFor="career-isCurrent" className="text-xs font-normal">Current position</Label>
                      </div>
                    </div>
                  </div>
                  <Textarea name="notes" placeholder="Notes" rows={1} className="text-sm" />
                  <Button type="submit" size="sm" className="h-8">
                    <Plus className="size-3 mr-1" /> Add Position
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>
        </div>

        {/* Right column — connections, dates, gifts, danger */}
        <div className="space-y-6">
          {/* Connections */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Link2 className="size-4" />
                Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {connections.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {connections.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {formatRelationship(r.relationType)}
                      </Badge>
                      <span className="text-muted-foreground text-xs">of</span>
                      <Link href={`/people/${r.toMember.id}`} className="text-sm font-medium hover:underline truncate">
                        {r.toMember.firstName} {r.toMember.lastName}
                      </Link>
                      {r.toMember.householdId !== householdId && (
                        <Badge variant="secondary" className="text-[9px] text-purple-700 dark:text-purple-400 shrink-0">Other</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-3">No connections defined yet.</p>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs w-full" asChild>
                <Link href="/family-tree/manage">Manage Connections</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Important Dates */}
          {member.importantDates.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="size-4" />
                  Important Dates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {member.importantDates.map((d) => (
                    <div key={d.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{d.label}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(d.date)}</p>
                      </div>
                      <Badge className={`text-[9px] ${DATE_TYPE_COLORS[d.type]}`}>{d.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gift History */}
          {member.gifts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Gift className="size-4" />
                  Gift History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {member.gifts.map((g) => (
                    <div key={g.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{g.description}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {g.occasion && `${g.occasion} · `}
                          {g.actualCost ? formatCurrency(g.actualCost.toString()) : g.estimatedCost ? `~${formatCurrency(g.estimatedCost.toString())}` : ""}
                        </p>
                      </div>
                      <Badge className={`text-[9px] ${STATUS_COLORS[g.status]}`}>{g.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gift Ideas */}
          {member.giftIdeas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Lightbulb className="size-4" />
                  Gift Ideas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {member.giftIdeas.map((gi) => (
                    <div key={gi.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{gi.idea}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {gi.estimatedCost ? formatCurrency(gi.estimatedCost.toString()) : ""}
                          {gi.source && ` · From: ${gi.source}`}
                        </p>
                      </div>
                      <Badge variant={gi.priority === "HIGH" ? "destructive" : gi.priority === "MEDIUM" ? "default" : "secondary"} className="text-[9px]">
                        {gi.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={deleteFamilyMemberAction}>
                <input type="hidden" name="id" value={member.id} />
                <p className="text-[10px] text-muted-foreground mb-3">
                  {isMe
                    ? "Remove yourself from the People directory. Your account will not be affected."
                    : "Permanently delete this person and all associated data."}
                </p>
                <Button type="submit" variant="destructive" size="sm" className="w-full h-8 text-xs">
                  <Trash2 className="size-3 mr-1.5" />
                  {isMe ? "Remove from People" : "Delete Person"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
