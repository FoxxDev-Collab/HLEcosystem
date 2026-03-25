export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHouseholdsForUser } from "@/lib/household";
import { switchHouseholdAction } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const households = await getHouseholdsForUser(user.id);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Select a Household</CardTitle>
          <CardDescription>
            Welcome, {user.name}! Choose a household to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {households.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">
              You are not a member of any household yet. Ask your admin to add you in{" "}
              <a href={process.env.AUTH_URL || "http://localhost:8080"} className="underline font-medium">
                Family Manager
              </a>.
            </p>
          ) : (
            <div className="space-y-2">
              {households.map((h) => (
                <form key={h.id} action={switchHouseholdAction}>
                  <input type="hidden" name="householdId" value={h.id} />
                  <Button type="submit" variant="outline" className="w-full justify-start">
                    {h.name}
                  </Button>
                </form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
