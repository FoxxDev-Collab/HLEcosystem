import { serve } from "bun";
import index from "./index.html";
import { requireAuth, requireHousehold } from "./server/auth";
import { getHouseholdsForUser } from "./server/household";

const port = Number(process.env.PORT) || 8090;

const server = serve({
  port,
  routes: {
    // Health check (unauthenticated; mirrors the rest of the ecosystem).
    "/api/health": {
      GET: () => Response.json({ status: "ok" }),
    },

    // Current user. Returns 401 if not signed in.
    "/api/me": {
      GET: requireAuth(async (_req, { user }) => {
        const households = await getHouseholdsForUser(user.id);
        return Response.json({ user, households });
      }),
    },

    // Library summary for the active household. Stub for now —
    // returns counts so the landing page can show something concrete.
    "/api/library/summary": {
      GET: requireHousehold(async (_req, { householdId: _hh }) => {
        // Real counts will land once the scanner exists; for now return
        // zeros so the UI can render the empty state.
        return Response.json({
          movies: 0,
          series: 0,
          episodes: 0,
        });
      }),
    },

    // Catch-all: serve the SPA shell.
    "/*": index,
  },

  development:
    process.env.NODE_ENV !== "production" && {
      hmr: true,
      console: true,
    },
});

console.log(`hle-media listening on ${server.url}`);
