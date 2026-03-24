import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserSessions } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Smartphone, Monitor } from "lucide-react";
import { TotpSetup } from "@/components/totp-setup";
import Link from "next/link";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  });

  const sessions = await getUserSessions(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground">
          Manage your authentication and session security
        </p>
      </div>

      {/* MFA Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
            {fullUser?.totpEnabled ? (
              <Badge className="bg-green-600">Enabled</Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </div>
          <CardDescription>
            Add an extra layer of security with a time-based one-time password (TOTP) from an authenticator app like Google Authenticator or Authy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TotpSetup
            enabled={fullUser?.totpEnabled ?? false}
            userEmail={user.email}
          />
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="size-5" />
              <CardTitle>Active Sessions</CardTitle>
            </div>
            <Link
              href="/security/sessions"
              className="text-sm text-primary hover:underline"
            >
              Manage all sessions
            </Link>
          </div>
          <CardDescription>
            You have {sessions.length} active session{sessions.length !== 1 ? "s" : ""} across the ecosystem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.slice(0, 3).map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 text-sm"
              >
                <Smartphone className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {session.userAgent
                      ? parseUserAgent(session.userAgent)
                      : "Unknown device"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.ipAddress ?? "Unknown IP"} &middot;{" "}
                    {session.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {sessions.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{sessions.length - 3} more sessions
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function parseUserAgent(ua: string): string {
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Mobile")) return "Mobile Browser";
  return ua.slice(0, 50);
}
