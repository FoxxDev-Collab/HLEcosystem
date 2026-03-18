import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { createMedicationAction, toggleMedicationActiveAction, recordRefillAction, deleteMedicationAction } from "./actions";

export default async function MedicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const memberFilter = params.memberId ? { familyMemberId: params.memberId } : {};

  const [members, medications] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId, isActive: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.medication.findMany({
      where: { familyMember: { householdId }, ...memberFilter },
      include: { familyMember: true },
      orderBy: [{ isActive: "desc" }, { medicationName: "asc" }],
    }),
  ]);

  const active = medications.filter((m) => m.isActive);
  const inactive = medications.filter((m) => !m.isActive);

  const today = new Date();
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() + 7);
  const refillsDue = active.filter((m) => m.nextRefillDate && m.nextRefillDate <= sevenDays);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Medications</h1>
        <p className="text-muted-foreground">{active.length} active · {inactive.length} inactive</p>
      </div>

      {/* Add */}
      <Card>
        <CardHeader><CardTitle>Add Medication</CardTitle></CardHeader>
        <CardContent>
          <form action={createMedicationAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Family Member</Label>
              <Select name="familyMemberId" defaultValue={params.memberId || members[0]?.id} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Medication Name</Label>
              <Input name="medicationName" required />
            </div>
            <div className="space-y-1">
              <Label>Dosage</Label>
              <Input name="dosage" placeholder="e.g. 10mg" />
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Input name="frequency" placeholder="e.g. Once daily" />
            </div>
            <div className="space-y-1">
              <Label>Prescribed By</Label>
              <Input name="prescribedBy" />
            </div>
            <div className="space-y-1">
              <Label>Pharmacy</Label>
              <Input name="pharmacy" />
            </div>
            <div className="space-y-1">
              <Label>Purpose</Label>
              <Input name="purpose" />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input name="startDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Next Refill Date</Label>
              <Input name="nextRefillDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Refills Remaining</Label>
              <Input name="refillsRemaining" type="number" min="0" />
            </div>
            <div className="space-y-1">
              <Label>Cost/Refill</Label>
              <Input name="costPerRefill" type="number" step="0.01" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" name="paidFromHsa" id="paidFromHsa" className="size-4" />
              <Label htmlFor="paidFromHsa" className="text-sm">HSA</Label>
            </div>
            <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Add Medication</Button>
          </form>
        </CardContent>
      </Card>

      {/* Refill Alerts */}
      {refillsDue.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2"><CardTitle className="text-base text-orange-700">Refills Due Soon</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {refillsDue.map((med) => (
                <div key={med.id} className="flex items-center justify-between">
                  <span className="text-sm">{med.medicationName} — {med.familyMember.firstName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{med.nextRefillDate ? formatDate(med.nextRefillDate) : ""}</span>
                    <form action={recordRefillAction}>
                      <input type="hidden" name="id" value={med.id} />
                      <Button type="submit" variant="outline" size="sm">
                        <RefreshCw className="size-3 mr-1" />Refilled
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Medications */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Active ({active.length})</h2>
          {active.map((med) => (
            <Card key={med.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{med.medicationName}</span>
                      <Badge variant="outline" className="text-xs">{med.familyMember.firstName}</Badge>
                      {med.paidFromHsa && <Badge variant="secondary" className="text-xs">HSA</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {med.dosage && `${med.dosage}`}
                      {med.frequency && ` · ${med.frequency}`}
                      {med.prescribedBy && ` · Dr. ${med.prescribedBy}`}
                      {med.pharmacy && ` · ${med.pharmacy}`}
                    </div>
                    {(med.nextRefillDate || med.refillsRemaining !== null) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {med.nextRefillDate && `Next refill: ${formatDate(med.nextRefillDate)}`}
                        {med.refillsRemaining !== null && ` · ${med.refillsRemaining} refills left`}
                        {med.costPerRefill && ` · ${formatCurrency(med.costPerRefill)}/refill`}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <form action={recordRefillAction}>
                      <input type="hidden" name="id" value={med.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Record refill">
                        <RefreshCw className="size-3.5" />
                      </Button>
                    </form>
                    <form action={toggleMedicationActiveAction}>
                      <input type="hidden" name="id" value={med.id} />
                      <input type="hidden" name="isActive" value="true" />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Deactivate">
                        <Pause className="size-3.5" />
                      </Button>
                    </form>
                    <form action={deleteMedicationAction}>
                      <input type="hidden" name="id" value={med.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Delete">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Inactive ({inactive.length})</h2>
          {inactive.map((med) => (
            <Card key={med.id} className="opacity-50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{med.medicationName}</span>
                    <span className="text-xs text-muted-foreground ml-2">{med.familyMember.firstName}</span>
                  </div>
                  <form action={toggleMedicationActiveAction}>
                    <input type="hidden" name="id" value={med.id} />
                    <input type="hidden" name="isActive" value="false" />
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Reactivate">
                      <Play className="size-3.5" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
