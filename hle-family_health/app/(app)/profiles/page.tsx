import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { createHealthProfileRecordAction, deleteHealthProfileRecordAction } from "./actions";

const BLOOD_TYPES = [
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE", "UNKNOWN",
];

function formatBloodType(bt: string) {
  return bt.replace(/_/g, " ").replace("POSITIVE", "+").replace("NEGATIVE", "-");
}

function formatHeight(cm: number | null): string {
  if (!cm) return "—";
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}" (${cm} cm)`;
}

function formatWeight(kg: number | null): string {
  if (!kg) return "—";
  const lbs = Math.round(kg * 2.20462);
  return `${lbs} lbs (${kg} kg)`;
}

function WeightTrend({ current, previous }: { current: number | null; previous: number | null }) {
  if (!current || !previous) return null;
  const diff = Number(current) - Number(previous);
  if (Math.abs(diff) < 0.1) return <Minus className="size-3.5 text-muted-foreground" />;
  if (diff > 0) return <TrendingUp className="size-3.5 text-orange-500" />;
  return <TrendingDown className="size-3.5 text-blue-500" />;
}

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
    include: {
      healthProfiles: {
        orderBy: { recordDate: "desc" },
      },
    },
    orderBy: { firstName: "asc" },
  });

  const selectedMemberId = params.memberId || members[0]?.id;
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const records = selectedMember?.healthProfiles || [];
  const latestRecord = records[0] || null;
  const previousRecord = records[1] || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Health Profiles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track health info over time. Each save creates a new record so you can see how height, weight, and conditions change.
        </p>
      </div>

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
                  {m.healthProfiles.length > 0 && ` (${m.healthProfiles.length})`}
                </Badge>
              </a>
            ))}
          </div>

          {selectedMember && (
            <>
              {/* New Record Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="size-4" />
                    New Record for {selectedMember.firstName}
                  </CardTitle>
                  <CardDescription>
                    {latestRecord
                      ? "Pre-filled from the most recent record. Update what changed and save."
                      : "Create the first health profile record."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={createHealthProfileRecordAction} className="space-y-6">
                    <input type="hidden" name="familyMemberId" value={selectedMember.id} />

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="space-y-1">
                        <Label>Record Date</Label>
                        <Input name="recordDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
                      </div>
                      <div className="space-y-1">
                        <Label>Blood Type</Label>
                        <Select name="bloodType" defaultValue={latestRecord?.bloodType || "UNKNOWN"}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BLOOD_TYPES.map((bt) => (
                              <SelectItem key={bt} value={bt}>{formatBloodType(bt)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Height (cm)</Label>
                        <Input name="heightCm" type="number" step="0.01" defaultValue={latestRecord?.heightCm ? Number(latestRecord.heightCm) : ""} />
                      </div>
                      <div className="space-y-1">
                        <Label>Weight (kg)</Label>
                        <Input name="weightKg" type="number" step="0.01" defaultValue={latestRecord?.weightKg ? Number(latestRecord.weightKg) : ""} />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" name="isOrganDonor" id="isOrganDonor" defaultChecked={latestRecord?.isOrganDonor} className="size-4" />
                        <Label htmlFor="isOrganDonor">Organ Donor</Label>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Primary Care Provider</Label>
                        <Input name="primaryCareProvider" defaultValue={latestRecord?.primaryCareProvider || ""} placeholder="Dr. Smith" />
                      </div>
                      <div className="space-y-1">
                        <Label>Preferred Hospital</Label>
                        <Input name="preferredHospital" defaultValue={latestRecord?.preferredHospital || ""} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Allergies (comma-separated)</Label>
                      <Input name="allergies" defaultValue={latestRecord?.allergies.join(", ") || ""} placeholder="Penicillin, Peanuts, Shellfish" />
                    </div>

                    <div className="space-y-1">
                      <Label>Chronic Conditions (comma-separated)</Label>
                      <Input name="chronicConditions" defaultValue={latestRecord?.chronicConditions.join(", ") || ""} placeholder="Asthma, Diabetes" />
                    </div>

                    <div className="space-y-1">
                      <Label>Major Surgeries (comma-separated)</Label>
                      <Input name="majorSurgeries" defaultValue={latestRecord?.majorSurgeries.join(", ") || ""} placeholder="Appendectomy 2020" />
                    </div>

                    <div className="space-y-1">
                      <Label>Medical Notes</Label>
                      <Textarea name="medicalNotes" defaultValue={latestRecord?.medicalNotes || ""} rows={3} />
                    </div>

                    <Button type="submit"><Plus className="size-4 mr-2" />Save New Record</Button>
                  </form>
                </CardContent>
              </Card>

              {/* Record History */}
              {records.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Record History ({records.length})</CardTitle>
                    <CardDescription>
                      Health profile records over time for {selectedMember.firstName}. Most recent first.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {records.map((record, idx) => {
                        const prev = records[idx + 1] || null;
                        return (
                          <div key={record.id} className={`rounded-lg border p-4 ${idx === 0 ? "border-primary/30 bg-primary/5" : ""}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-medium">{formatDate(record.recordDate)}</span>
                                  {idx === 0 && <Badge>Current</Badge>}
                                </div>
                                <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">Height:</span>
                                    <span>{formatHeight(record.heightCm ? Number(record.heightCm) : null)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">Weight:</span>
                                    <span>{formatWeight(record.weightKg ? Number(record.weightKg) : null)}</span>
                                    <WeightTrend current={record.weightKg ? Number(record.weightKg) : null} previous={prev?.weightKg ? Number(prev.weightKg) : null} />
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Blood Type:</span>{" "}
                                    <span>{formatBloodType(record.bloodType)}</span>
                                  </div>
                                  {record.primaryCareProvider && (
                                    <div>
                                      <span className="text-muted-foreground">PCP:</span>{" "}
                                      <span>{record.primaryCareProvider}</span>
                                    </div>
                                  )}
                                  {record.preferredHospital && (
                                    <div>
                                      <span className="text-muted-foreground">Hospital:</span>{" "}
                                      <span>{record.preferredHospital}</span>
                                    </div>
                                  )}
                                  {record.isOrganDonor && (
                                    <div><Badge variant="outline" className="text-xs">Organ Donor</Badge></div>
                                  )}
                                </div>
                                {record.allergies.length > 0 && (
                                  <div className="mt-1 text-sm">
                                    <span className="text-muted-foreground">Allergies:</span>{" "}
                                    {record.allergies.map((a) => (
                                      <Badge key={a} variant="secondary" className="text-xs mr-1">{a}</Badge>
                                    ))}
                                  </div>
                                )}
                                {record.chronicConditions.length > 0 && (
                                  <div className="mt-1 text-sm">
                                    <span className="text-muted-foreground">Conditions:</span>{" "}
                                    {record.chronicConditions.map((c) => (
                                      <Badge key={c} variant="secondary" className="text-xs mr-1">{c}</Badge>
                                    ))}
                                  </div>
                                )}
                                {record.majorSurgeries.length > 0 && (
                                  <div className="mt-1 text-sm">
                                    <span className="text-muted-foreground">Surgeries:</span>{" "}
                                    {record.majorSurgeries.join(", ")}
                                  </div>
                                )}
                                {record.medicalNotes && (
                                  <div className="mt-1 text-sm text-muted-foreground italic">{record.medicalNotes}</div>
                                )}
                              </div>
                              <form action={deleteHealthProfileRecordAction}>
                                <input type="hidden" name="id" value={record.id} />
                                <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0">
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </form>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
