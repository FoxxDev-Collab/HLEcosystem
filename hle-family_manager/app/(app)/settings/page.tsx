import { getUserCounts } from "@/lib/users";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, UserCheck, UserX, Lock, Home } from "lucide-react";

export default async function SettingsPage() {
  const [counts, householdCount] = await Promise.all([
    getUserCounts(),
    prisma.household.count(),
  ]);

  const stats = [
    { label: "Total Users", value: counts.total, icon: Users },
    { label: "Active", value: counts.active, icon: UserCheck },
    { label: "Inactive", value: counts.inactive, icon: UserX },
    { label: "Admins", value: counts.admins, icon: Shield },
    { label: "Members", value: counts.members, icon: Users },
    { label: "With Password", value: counts.withPassword, icon: Lock },
    { label: "Households", value: householdCount, icon: Home },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 p-3 rounded-lg border">
                <stat.icon className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About Family Manager</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Family Manager is the central user management system for the HLEcosystem.
            Users created here are available across all family apps.
          </p>
          <p>
            Other apps (Family Finance, Family Health, etc.) reference users from
            Family Manager via cross-schema queries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
