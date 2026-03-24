import { redirect } from "next/navigation";
import { getCurrentUser, getSessionToken } from "@/lib/auth";
import { getUserSessions } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Monitor, Trash2 } from "lucide-react";
import { revokeSessionAction, revokeAllOtherSessionsAction } from "./actions";
import Link from "next/link";

export default async function SessionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const currentToken = await getSessionToken();
  const sessions = await getUserSessions(user.id);

  // Find current session by matching token
  const currentSessionId = sessions.find((s) => {
    // We can't compare tokens directly from the list (not selected),
    // so we'll mark by checking in the action. For now, show all.
    return false;
  })?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/security"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Security
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Active Sessions
          </h1>
          <p className="text-muted-foreground">
            Manage your active login sessions across all apps
          </p>
        </div>
        {sessions.length > 1 && (
          <form action={revokeAllOtherSessionsAction}>
            <Button type="submit" variant="outline" size="sm">
              Revoke all other sessions
            </Button>
          </form>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="size-5" />
            {sessions.length} Active Session{sessions.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active sessions found.
            </p>
          ) : (
            <div className="divide-y">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {session.userAgent
                          ? parseUserAgent(session.userAgent)
                          : "Unknown device"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      IP: {session.ipAddress ?? "Unknown"} &middot; Created:{" "}
                      {session.createdAt.toLocaleString()} &middot; Expires:{" "}
                      {session.expiresAt.toLocaleString()}
                    </p>
                  </div>
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Revoke session"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
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
