import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdById } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const household = await getHouseholdById(householdId);
  if (!household) redirect("/setup");

  const [accountCount, transactionCount, categoryCount] = await Promise.all([
    prisma.account.count({ where: { householdId } }),
    prisma.transaction.count({ where: { householdId } }),
    prisma.category.count({ where: { householdId } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Household</CardTitle>
          <CardDescription>Your household information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <span className="font-medium">Name:</span>{" "}
            <span className="text-muted-foreground">{household.name}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Summary</CardTitle>
          <CardDescription>Overview of your finance data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center p-4 rounded-lg border">
              <div className="text-3xl font-bold">{accountCount}</div>
              <div className="text-sm text-muted-foreground">Accounts</div>
            </div>
            <div className="text-center p-4 rounded-lg border">
              <div className="text-3xl font-bold">{transactionCount}</div>
              <div className="text-sm text-muted-foreground">Transactions</div>
            </div>
            <div className="text-center p-4 rounded-lg border">
              <div className="text-3xl font-bold">{categoryCount}</div>
              <div className="text-sm text-muted-foreground">Categories</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Name</div>
              <div className="text-sm text-muted-foreground">{user.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Email</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
