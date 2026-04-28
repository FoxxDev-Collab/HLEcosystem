import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { LibraryGrid } from "@/components/library-grid";
import { MovieDetail } from "@/components/movie-detail";
import { Player } from "@/components/player";
import { SeriesDetail } from "@/components/series-detail";
import { useRoute } from "@/lib/router";
import type { CurrentUser, Household } from "@/lib/types";
import "./index.css";

const FM_LOGIN_URL = `${process.env.BUN_PUBLIC_AUTH_URL || "http://localhost:8080"}/login`;

type Bootstrap =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "no_households" }
  | { kind: "ready"; user: CurrentUser; households: Household[] }
  | { kind: "error"; message: string };

async function bootstrap(): Promise<Bootstrap> {
  try {
    const meRes = await fetch("/api/me", { credentials: "include" });
    if (meRes.status === 401) return { kind: "anonymous" };
    if (!meRes.ok) {
      return { kind: "error", message: `me ${meRes.status}` };
    }
    const me = (await meRes.json()) as {
      user: CurrentUser;
      households: Household[];
    };
    if (me.households.length === 0) return { kind: "no_households" };

    // Probe library to detect whether a household cookie is set + valid.
    // 409 from the server means "household not selected" → auto-pick the
    // first one. Any other failure is shown to the user.
    const probe = await fetch("/api/library/summary", {
      credentials: "include",
    });
    if (probe.status === 409) {
      const sel = await fetch("/api/household/select", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: me.households[0]!.id }),
      });
      if (!sel.ok) {
        return { kind: "error", message: `household select ${sel.status}` };
      }
    }
    return { kind: "ready", user: me.user, households: me.households };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "network error",
    };
  }
}

export function App() {
  const [state, setState] = useState<Bootstrap>({ kind: "loading" });
  const route = useRoute();

  useEffect(() => {
    bootstrap().then(setState);
  }, []);

  if (state.kind === "loading") {
    return <Centered>Loading…</Centered>;
  }
  if (state.kind === "anonymous") {
    return (
      <Centered>
        Not signed in.{" "}
        <a className="underline" href={FM_LOGIN_URL}>
          Sign in via Family Manager →
        </a>
      </Centered>
    );
  }
  if (state.kind === "no_households") {
    return <Centered>No households linked to this account.</Centered>;
  }
  if (state.kind === "error") {
    return <Centered tone="error">Error: {state.message}</Centered>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={state.user} />
      <main className="flex-1 container mx-auto max-w-6xl p-6">
        {route.name === "home" && <LibraryGrid />}
        {route.name === "movie" && <MovieDetail id={route.id} />}
        {route.name === "series" && <SeriesDetail id={route.id} />}
        {route.name === "play" && <Player fileId={route.fileId} />}
      </main>
    </div>
  );
}

function Centered({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "error";
}) {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <p className={`text-sm ${tone === "error" ? "text-destructive" : ""}`}>
        {children}
      </p>
    </div>
  );
}

export default App;
