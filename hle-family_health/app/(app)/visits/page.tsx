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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { createVisitSummaryAction, deleteVisitSummaryAction } from "./actions";

const VISIT_TYPES = ["IN_PERSON", "TELEHEALTH", "EMERGENCY", "HOSPITAL", "URGENT_CARE"];

export default async function VisitsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [members, providers, visits] = await Promise.all([
    prisma.familyMember.findMany({ where: { householdId, isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.provider.findMany({ where: { householdId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.visitSummary.findMany({
      where: { familyMember: { householdId } },
      include: { familyMember: true, provider: true },
      orderBy: { visitDate: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Visit Summaries</h1>

      <Card>
        <CardHeader><CardTitle>Record Visit</CardTitle></CardHeader>
        <CardContent>
          <form action={createVisitSummaryAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Family Member</Label>
                <Select name="familyMemberId" defaultValue={members[0]?.id} required>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Provider</Label>
                <Select name="providerId">
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Visit Date</Label>
                <Input name="visitDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
              </div>
              <div className="space-y-1">
                <Label>Visit Type</Label>
                <Select name="visitType" defaultValue="IN_PERSON">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VISIT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label>Chief Complaint</Label><Input name="chiefComplaint" /></div>
              <div className="space-y-1"><Label>Diagnosis</Label><Input name="diagnosis" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label>Treatment Provided</Label><Textarea name="treatmentProvided" rows={2} /></div>
              <div className="space-y-1"><Label>Follow-Up Instructions</Label><Textarea name="followUpInstructions" rows={2} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1"><Label>Prescriptions Written</Label><Input name="prescriptionsWritten" /></div>
              <div className="space-y-1"><Label>Lab Tests Ordered</Label><Input name="labTestsOrdered" /></div>
              <div className="space-y-1"><Label>Notes</Label><Input name="notes" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1"><Label>Billed Amount</Label><Input name="billedAmount" type="number" step="0.01" /></div>
              <div className="space-y-1"><Label>Insurance Paid</Label><Input name="insurancePaid" type="number" step="0.01" /></div>
              <div className="space-y-1"><Label>Out of Pocket</Label><Input name="outOfPocketCost" type="number" step="0.01" /></div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" name="paidFromHsa" id="paidFromHsa" className="size-4" />
                <Label htmlFor="paidFromHsa">Paid from HSA</Label>
              </div>
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Record Visit</Button>
          </form>
        </CardContent>
      </Card>

      {visits.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No visit summaries yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => (
            <Card key={visit.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{visit.familyMember.firstName} {visit.familyMember.lastName}</span>
                      <Badge variant="outline" className="text-xs">{visit.visitType.replace(/_/g, " ")}</Badge>
                      {visit.paidFromHsa && <Badge variant="secondary" className="text-xs">HSA</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(visit.visitDate)}
                      {visit.provider && ` · ${visit.provider.name}`}
                      {visit.chiefComplaint && ` · ${visit.chiefComplaint}`}
                    </div>
                    {visit.diagnosis && <div className="text-xs mt-1">Dx: {visit.diagnosis}</div>}
                    {visit.treatmentProvided && <div className="text-xs text-muted-foreground mt-0.5">Tx: {visit.treatmentProvided}</div>}
                    {(visit.billedAmount || visit.outOfPocketCost) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {visit.billedAmount && `Billed: ${formatCurrency(visit.billedAmount)}`}
                        {visit.insurancePaid && ` · Ins: ${formatCurrency(visit.insurancePaid)}`}
                        {visit.outOfPocketCost && ` · OOP: ${formatCurrency(visit.outOfPocketCost)}`}
                      </div>
                    )}
                  </div>
                  <form action={deleteVisitSummaryAction}>
                    <input type="hidden" name="id" value={visit.id} />
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="size-3.5" /></Button>
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
