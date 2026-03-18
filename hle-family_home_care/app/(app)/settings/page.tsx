import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Card>
        <CardHeader><CardTitle>Home Care Settings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Settings and preferences for the Home Care app will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
