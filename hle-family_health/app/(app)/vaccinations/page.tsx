import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { createVaccinationAction, deleteVaccinationAction } from "./actions";

export default async function VaccinationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [members, vaccinations] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId, isActive: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.vaccination.findMany({
      where: { familyMember: { householdId } },
      include: { familyMember: true },
      orderBy: { dateAdministered: "desc" },
    }),
  ]);

  const now = new Date();
  const thirtyDays = new Date(now);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const upcoming = vaccinations.filter((v) => v.nextDoseDate && v.nextDoseDate >= now && v.nextDoseDate <= thirtyDays);

  // Group by member
  const byMember = new Map<string, typeof vaccinations>();
  for (const vax of vaccinations) {
    const name = `${vax.familyMember.firstName} ${vax.familyMember.lastName}`;
    const existing = byMember.get(name) || [];
    existing.push(vax);
    byMember.set(name, existing);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Vaccinations</h1>

      {/* Add */}
      <Card>
        <CardHeader><CardTitle>Record Vaccination</CardTitle></CardHeader>
        <CardContent>
          <form action={createVaccinationAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Family Member</Label>
              <Select name="familyMemberId" defaultValue={members[0]?.id} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vaccine Name</Label>
              <Input name="vaccineName" placeholder="e.g. COVID-19, Flu" required />
            </div>
            <div className="space-y-1">
              <Label>Dose #</Label>
              <Input name="doseNumber" placeholder="e.g. 1st, 2nd, Booster" />
            </div>
            <div className="space-y-1">
              <Label>Date Administered</Label>
              <Input name="dateAdministered" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
            <div className="space-y-1">
              <Label>Next Dose Date</Label>
              <Input name="nextDoseDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Administered By</Label>
              <Input name="administeredBy" />
            </div>
            <div className="space-y-1">
              <Label>Lot Number</Label>
              <Input name="lotNumber" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Record</Button>
          </form>
        </CardContent>
      </Card>

      {/* Upcoming Doses */}
      {upcoming.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2"><CardTitle className="text-base text-blue-700">Upcoming Doses (Next 30 Days)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((vax) => (
                <div key={vax.id} className="flex justify-between text-sm">
                  <span>{vax.vaccineName} — {vax.familyMember.firstName}</span>
                  <span className="text-muted-foreground">{vax.nextDoseDate ? formatDate(vax.nextDoseDate) : ""}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By Member */}
      {Array.from(byMember.entries()).map(([name, vaxes]) => (
        <Card key={name}>
          <CardHeader>
            <CardTitle className="text-base">{name} ({vaxes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {vaxes.map((vax) => (
                <div key={vax.id} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{vax.vaccineName}</span>
                      {vax.doseNumber && <Badge variant="outline" className="text-xs">{vax.doseNumber}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(vax.dateAdministered)}
                      {vax.administeredBy && ` · ${vax.administeredBy}`}
                      {vax.lotNumber && ` · Lot: ${vax.lotNumber}`}
                      {vax.nextDoseDate && ` · Next: ${formatDate(vax.nextDoseDate)}`}
                    </div>
                  </div>
                  <form action={deleteVaccinationAction}>
                    <input type="hidden" name="id" value={vax.id} />
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {vaccinations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No vaccinations recorded yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
