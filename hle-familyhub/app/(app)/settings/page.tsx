import { getCurrentHouseholdId, getHouseholdById } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const householdId = (await getCurrentHouseholdId())!;

  const [household, memberCount, dateCount, giftCount, ideaCount] = await Promise.all([
    getHouseholdById(householdId),
    prisma.familyMember.count({ where: { householdId } }),
    prisma.importantDate.count({ where: { householdId } }),
    prisma.gift.count({ where: { householdId } }),
    prisma.giftIdea.count({ where: { householdId } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Household</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium">{household?.name ?? "Unknown"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">People</p>
              <p className="text-2xl font-bold">{memberCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Important Dates</p>
              <p className="text-2xl font-bold">{dateCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gifts</p>
              <p className="text-2xl font-bold">{giftCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gift Ideas</p>
              <p className="text-2xl font-bold">{ideaCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
