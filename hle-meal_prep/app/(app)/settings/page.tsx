import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChefHat, CheckCircle, XCircle, Unplug, RefreshCw, Database } from "lucide-react";
import { saveMealieConfigAction, testMealieConfigAction, disconnectMealieAction, syncNowAction } from "./actions";
import { getSyncState } from "@/lib/mealie-cache";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ mealie_test?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { mealie_test } = await searchParams;

  const [config, syncState] = await Promise.all([
    prisma.mealieConfig.findUnique({ where: { householdId } }),
    getSyncState(householdId),
  ]);

  const testResult = mealie_test
    ? mealie_test === "ok"
      ? { ok: true as const }
      : { ok: false as const, error: decodeURIComponent(mealie_test) }
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Mealie Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="size-5" />
            Mealie Integration
          </CardTitle>
          <CardDescription>
            Connect your Mealie instance to sync meal plan ingredients into shopping lists.
            Each household has its own Mealie connection — your API key is not shared with other households.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {config.isActive ? (
                <>
                  <CheckCircle className="size-5 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Connected</div>
                    <div className="text-xs text-muted-foreground truncate">{config.apiUrl}</div>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </>
              ) : (
                <>
                  <XCircle className="size-5 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Connection Failed</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {config.apiUrl} — check your URL and API token
                    </div>
                  </div>
                  <Badge variant="destructive">Inactive</Badge>
                </>
              )}
            </div>
          )}

          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              testResult.ok ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"
            }`}>
              {testResult.ok ? (
                <>
                  <CheckCircle className="size-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    Connection test successful
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-red-500" />
                  <span className="text-sm text-red-700 dark:text-red-400">
                    Connection failed: {testResult.error}
                  </span>
                </>
              )}
            </div>
          )}

          <form action={saveMealieConfigAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">Mealie URL</Label>
              <Input
                id="apiUrl"
                name="apiUrl"
                placeholder="https://mealie.example.com"
                defaultValue={config?.apiUrl || ""}
                required
              />
              <p className="text-xs text-muted-foreground">
                The full URL to your Mealie instance (no trailing slash)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                name="apiToken"
                type="password"
                placeholder={config ? "••••••••••••••••" : "Paste your Mealie API token"}
                defaultValue={config?.apiToken || ""}
                required
              />
              <p className="text-xs text-muted-foreground">
                Generate a token in Mealie: User Profile → API Tokens → Create Token
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit">
                {config ? "Update Connection" : "Connect to Mealie"}
              </Button>
              <Button type="submit" variant="outline" formAction={testMealieConfigAction}>
                Test Connection
              </Button>
            </div>
          </form>

          {config && config.isActive && (
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Database className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Local cache:</span>
                  {syncState?.recipesSyncedAt ? (
                    <span className="font-medium">
                      {syncState.recipeTotalCount} recipes · last synced{" "}
                      {new Date(syncState.recipesSyncedAt).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not synced yet</span>
                  )}
                </div>
                <form action={syncNowAction}>
                  <Button type="submit" variant="outline" size="sm" className="gap-1.5">
                    <RefreshCw className="size-3.5" />
                    Sync Now
                  </Button>
                </form>
              </div>
            </div>
          )}

          {config && (
            <div className="pt-4 border-t">
              <form action={disconnectMealieAction}>
                <Button type="submit" variant="destructive" size="sm" className="gap-2">
                  <Unplug className="size-3.5" />
                  Disconnect Mealie
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
