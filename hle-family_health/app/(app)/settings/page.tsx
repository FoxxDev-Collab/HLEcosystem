import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdById } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const household = await getHouseholdById(householdId);

  const [familyCount, apptCount, medCount, vaxCount, provCount, insCount, visitCount, expCount, workoutCount] =
    await Promise.all([
      prisma.familyMember.count({ where: { householdId } }),
      prisma.appointment.count({ where: { familyMember: { householdId } } }),
      prisma.medication.count({ where: { familyMember: { householdId } } }),
      prisma.vaccination.count({ where: { familyMember: { householdId } } }),
      prisma.provider.count({ where: { householdId } }),
      prisma.insurance.count({ where: { familyMember: { householdId } } }),
      prisma.visitSummary.count({ where: { familyMember: { householdId } } }),
      prisma.medicalExpense.count({ where: { familyMember: { householdId } } }),
      prisma.workout.count({ where: { familyMember: { householdId } } }),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Household</CardTitle>
          <CardDescription>{household?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Managed in Family Manager
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="text-sm"><span className="font-medium">{familyCount}</span> family members</div>
            <div className="text-sm"><span className="font-medium">{apptCount}</span> appointments</div>
            <div className="text-sm"><span className="font-medium">{medCount}</span> medications</div>
            <div className="text-sm"><span className="font-medium">{vaxCount}</span> vaccinations</div>
            <div className="text-sm"><span className="font-medium">{provCount}</span> providers</div>
            <div className="text-sm"><span className="font-medium">{insCount}</span> insurance policies</div>
            <div className="text-sm"><span className="font-medium">{visitCount}</span> visit summaries</div>
            <div className="text-sm"><span className="font-medium">{expCount}</span> medical expenses</div>
            <div className="text-sm"><span className="font-medium">{workoutCount}</span> workouts</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
