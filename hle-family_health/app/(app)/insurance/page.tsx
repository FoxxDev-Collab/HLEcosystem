import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ExternalLink, Users, Shield } from "lucide-react";
import { createInsurancePolicyAction, updatePolicyCoverageAction, togglePolicyActiveAction, deletePolicyAction } from "./actions";

const INSURANCE_TYPES = ["MEDICAL", "DENTAL", "VISION", "PRESCRIPTION", "SUPPLEMENTAL", "OTHER"];

export default async function InsurancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [members, policies] = await Promise.all([
    prisma.familyMember.findMany({ where: { householdId, isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.insurancePolicy.findMany({
      where: { householdId },
      include: { coveredMembers: { include: { familyMember: true } } },
      orderBy: [{ isActive: "desc" }, { insuranceType: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insurance Policies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage household policies and assign covered family members. One policy can cover the whole family.
        </p>
      </div>

      {/* Add Policy Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="size-4" /> Add Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createInsurancePolicyAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
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
              <div className="space-y-1"><Label>Policy Holder Name</Label><Input name="policyHolderName" /></div>
              <div className="space-y-1"><Label>Deductible</Label><Input name="deductible" type="number" step="0.01" /></div>
              <div className="space-y-1"><Label>Out-of-Pocket Max</Label><Input name="outOfPocketMax" type="number" step="0.01" /></div>
              <div className="space-y-1"><Label>Copay</Label><Input name="copay" type="number" step="0.01" /></div>
              <div className="space-y-1"><Label>Effective Date</Label><Input name="effectiveDate" type="date" /></div>
              <div className="space-y-1"><Label>Expiration Date</Label><Input name="expirationDate" type="date" /></div>
              <div className="space-y-1"><Label>Phone</Label><Input name="phoneNumber" /></div>
              <div className="space-y-1"><Label>Website</Label><Input name="website" type="url" /></div>
            </div>

            {/* Covered Members Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Users className="size-4" /> Covered Family Members</Label>
              <div className="flex flex-wrap gap-3">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                    <input type="checkbox" name="coveredMemberIds" value={m.id} defaultChecked className="size-4 accent-primary" />
                    {m.firstName} {m.lastName}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Select all family members covered under this policy.</p>
            </div>

            <Button type="submit" className="w-full sm:w-auto"><Plus className="size-4 mr-2" />Add Policy</Button>
          </form>
        </CardContent>
      </Card>

      {/* Policy List */}
      {policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No insurance policies yet. Add your first policy above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => {
            const coveredNames = policy.coveredMembers.map((c) => c.familyMember.firstName);
            return (
              <Card key={policy.id} className={!policy.isActive ? "opacity-50" : ""}>
                <CardContent className="py-5">
                  <div className="space-y-3">
                    {/* Policy Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-base">{policy.providerName}</span>
                          <Badge variant="outline" className="text-xs">{policy.insuranceType}</Badge>
                          {!policy.isActive && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          <div>
                            Policy: {policy.policyNumber}
                            {policy.groupNumber && <> &middot; Group: {policy.groupNumber}</>}
                            {policy.policyHolderName && <> &middot; Holder: {policy.policyHolderName}</>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            {policy.deductible && <span>Deductible: {formatCurrency(policy.deductible)}</span>}
                            {policy.outOfPocketMax && <span>OOP Max: {formatCurrency(policy.outOfPocketMax)}</span>}
                            {policy.copay && <span>Copay: {formatCurrency(policy.copay)}</span>}
                          </div>
                          {(policy.effectiveDate || policy.expirationDate) && (
                            <div>
                              {policy.effectiveDate && <>Effective: {formatDate(policy.effectiveDate)}</>}
                              {policy.expirationDate && <> &middot; Expires: {formatDate(policy.expirationDate)}</>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {policy.website && (
                          <a href={policy.website} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="size-3.5" /></Button>
                          </a>
                        )}
                        <form action={togglePolicyActiveAction}>
                          <input type="hidden" name="id" value={policy.id} />
                          <input type="hidden" name="isActive" value={String(policy.isActive)} />
                          <Button type="submit" variant="outline" size="sm">{policy.isActive ? "Deactivate" : "Activate"}</Button>
                        </form>
                        <form action={deletePolicyAction}>
                          <input type="hidden" name="id" value={policy.id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="size-3.5" /></Button>
                        </form>
                      </div>
                    </div>

                    {/* Covered Members */}
                    <div className="border-t pt-3">
                      <form action={updatePolicyCoverageAction} className="space-y-2">
                        <input type="hidden" name="policyId" value={policy.id} />
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Covered Members ({coveredNames.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {members.map((m) => {
                            const isCovered = policy.coveredMembers.some((c) => c.familyMemberId === m.id);
                            return (
                              <label key={m.id} className="flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted transition-colors has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                                <input type="checkbox" name="coveredMemberIds" value={m.id} defaultChecked={isCovered} className="size-3.5 accent-primary" />
                                {m.firstName}
                              </label>
                            );
                          })}
                        </div>
                        <Button type="submit" variant="secondary" size="sm">Update Coverage</Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
