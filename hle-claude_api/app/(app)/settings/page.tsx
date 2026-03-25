import { getConfig } from "@/lib/service-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettingsAction } from "./actions";

export default async function SettingsPage() {
  const [enabled, defaultModel, rateLimit, monthlyCostLimit] = await Promise.all([
    getConfig("service_enabled"),
    getConfig("default_model"),
    getConfig("rate_limit_per_minute"),
    getConfig("monthly_cost_limit"),
  ]);

  const isEnabled = enabled !== "false";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure the Claude API Gateway</p>
      </div>

      <form action={updateSettingsAction}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>Enable or disable the AI gateway for all consumer apps</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label htmlFor="service_enabled">Service Enabled</Label>
                <select
                  id="service_enabled"
                  name="service_enabled"
                  defaultValue={isEnabled ? "true" : "false"}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
              <CardDescription>Default model and token limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="default_model">Default Model</Label>
                <select
                  id="default_model"
                  name="default_model"
                  defaultValue={defaultModel ?? "claude-sonnet-4-20250514"}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4 ($3/$15 per 1M tokens)</option>
                  <option value="claude-haiku-35-20241022">Claude Haiku 3.5 ($0.80/$4 per 1M tokens)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>Control request volume and cost</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rate_limit_per_minute">Rate Limit (requests/minute)</Label>
                <Input
                  id="rate_limit_per_minute"
                  name="rate_limit_per_minute"
                  type="number"
                  defaultValue={rateLimit ?? "60"}
                  placeholder="60"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="monthly_cost_limit">Monthly Cost Limit (USD)</Label>
                <Input
                  id="monthly_cost_limit"
                  name="monthly_cost_limit"
                  type="number"
                  step="0.01"
                  defaultValue={monthlyCostLimit ?? "50"}
                  placeholder="50.00"
                />
                <p className="text-xs text-muted-foreground">
                  Service auto-disables if monthly cost exceeds this limit
                </p>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg">Save Settings</Button>
        </div>
      </form>
    </div>
  );
}
