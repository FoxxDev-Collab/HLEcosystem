import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Name:</span>{" "}
            <span className="text-sm font-medium">{user?.name}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Email:</span>{" "}
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
