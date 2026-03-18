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
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { createInsuranceAction, toggleInsuranceActiveAction, deleteInsuranceAction } from "./actions";

const INSURANCE_TYPES = ["MEDICAL", "DENTAL", "VISION", "PRESCRIPTION", "SUPPLEMENTAL", "OTHER"];

export default async function InsurancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [members, insurances] = await Promise.all([
    prisma.familyMember.findMany({ where: { householdId, isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.insurance.findMany({
      where: { familyMember: { householdId } },
      include: { familyMember: true },
      orderBy: [{ isActive: "desc" }, { insuranceType: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Insurance Policies</h1>

      <Card>
        <CardHeader><CardTitle>Add Policy</CardTitle></CardHeader>
        <CardContent>
          <form action={createInsuranceAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
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
              <Label>Insurance Provider</Label>
              <Input name="providerName" placeholder="e.g. Blue Cross" required />
            </div>
            <div className="space-y-1">
              <Label>Policy Number</Label>
              <Input name="policyNumber" required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="insuranceType" defaultValue="MEDICAL">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSURANCE_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Group #</Label><Input name="groupNumber" /></div>
            <div className="space-y-1"><Label>Deductible</Label><Input name="deductible" type="number" step="0.01" /></div>
            <div className="space-y-1"><Label>Out-of-Pocket Max</Label><Input name="outOfPocketMax" type="number" step="0.01" /></div>
            <div className="space-y-1"><Label>Copay</Label><Input name="copay" type="number" step="0.01" /></div>
            <div className="space-y-1"><Label>Effective Date</Label><Input name="effectiveDate" type="date" /></div>
            <div className="space-y-1"><Label>Expiration Date</Label><Input name="expirationDate" type="date" /></div>
            <div className="space-y-1"><Label>Phone</Label><Input name="phoneNumber" /></div>
            <div className="space-y-1"><Label>Website</Label><Input name="website" type="url" /></div>
            <Button type="submit" className="lg:col-span-4"><Plus className="size-4 mr-2" />Add Policy</Button>
          </form>
        </CardContent>
      </Card>

      {insurances.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No insurance policies yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {insurances.map((ins) => (
            <Card key={ins.id} className={!ins.isActive ? "opacity-50" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ins.providerName}</span>
                      <Badge variant="outline" className="text-xs">{ins.insuranceType}</Badge>
                      <Badge variant="secondary" className="text-xs">{ins.familyMember.firstName}</Badge>
                      {!ins.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Policy: {ins.policyNumber}
                      {ins.groupNumber && ` · Group: ${ins.groupNumber}`}
                      {ins.deductible && ` · Ded: ${formatCurrency(ins.deductible)}`}
                      {ins.copay && ` · Copay: ${formatCurrency(ins.copay)}`}
                    </div>
                    {(ins.effectiveDate || ins.expirationDate) && (
                      <div className="text-xs text-muted-foreground">
                        {ins.effectiveDate && `Effective: ${formatDate(ins.effectiveDate)}`}
                        {ins.expirationDate && ` · Expires: ${formatDate(ins.expirationDate)}`}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {ins.website && (
                      <a href={ins.website} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="size-3.5" /></Button>
                      </a>
                    )}
                    <form action={toggleInsuranceActiveAction}>
                      <input type="hidden" name="id" value={ins.id} />
                      <input type="hidden" name="isActive" value={String(ins.isActive)} />
                      <Button type="submit" variant="outline" size="sm">{ins.isActive ? "Deactivate" : "Activate"}</Button>
                    </form>
                    <form action={deleteInsuranceAction}>
                      <input type="hidden" name="id" value={ins.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="size-3.5" /></Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
