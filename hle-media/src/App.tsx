import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import "./index.css";

type Household = { id: string; name: string };
type User = { id: string; email: string; name: string; role: "ADMIN" | "MEMBER" };
type Me = { user: User; households: Household[] };

// Bun replaces process.env.BUN_PUBLIC_* at bundle time; the value baked
// into the bundle is whatever the env held when the server first served
// the HTML import. Compose sets BUN_PUBLIC_AUTH_URL from AUTH_URL.
const FM_LOGIN_URL = `${process.env.BUN_PUBLIC_AUTH_URL || "http://localhost:8080"}/login`;

export function App() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "anonymous" }
    | { kind: "ready"; me: Me }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (res.status === 401) {
          setState({ kind: "anonymous" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", message: `unexpected ${res.status}` });
          return;
        }
        setState({ kind: "ready", me: (await res.json()) as Me });
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "network error",
        });
      }
    })();
  }, []);

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">hle-media</CardTitle>
          <CardDescription>
            Family media library, IPTV channels, and a Plex-lite player.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.kind === "loading" && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}

          {state.kind === "anonymous" && (
            <p className="text-sm">
              You are not signed in.{" "}
              <a className="underline" href={FM_LOGIN_URL}>
                Sign in via Family Manager
              </a>
              .
            </p>
          )}

          {state.kind === "ready" && (
            <div className="space-y-2 text-sm">
              <p>
                Signed in as <span className="font-medium">{state.me.user.name}</span>{" "}
                ({state.me.user.email})
              </p>
              <p className="text-muted-foreground">
                {state.me.households.length === 0
                  ? "No households linked to this account yet."
                  : `Households: ${state.me.households.map((h) => h.name).join(", ")}`}
              </p>
            </div>
          )}

          {state.kind === "error" && (
            <p className="text-sm text-destructive">Error: {state.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
