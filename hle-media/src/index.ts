import { serve } from "bun";
import index from "./index.html";
import {
  requireAuth,
  requireHousehold,
  requireHouseholdAdmin,
} from "./server/auth";
import {
  HOUSEHOLD_COOKIE,
  getHouseholdsForUser,
  userBelongsToHousehold,
} from "./server/household";
import { serializeCookie } from "./server/cookies";
import { param } from "./server/request";
import {
  getLibraryCounts,
  getMovie,
  getSeries,
  listLibrary,
} from "./server/library";
import {
  getScanRun,
  listScanRunsForHousehold,
  startScan,
} from "./server/scan-runs";
import { enrichHousehold } from "./server/enrichment";
import { streamHandler } from "./server/stream";

const port = Number(process.env.PORT) || 8090;

const server = serve({
  port,
  routes: {
    // ─── Public ────────────────────────────────────────────────────────────
    "/api/health": {
      GET: () => Response.json({ status: "ok" }),
    },

    // ─── Auth / household ─────────────────────────────────────────────────
    "/api/me": {
      GET: requireAuth(async (_req, { user }) => {
        const households = await getHouseholdsForUser(user.id);
        return Response.json({ user, households });
      }),
    },

    "/api/household/select": {
      POST: requireAuth(async (req, { user }) => {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
        if (
          !body ||
          typeof body !== "object" ||
          !("householdId" in body) ||
          typeof (body as { householdId: unknown }).householdId !== "string"
        ) {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }
        const householdId = (body as { householdId: string }).householdId;
        if (!(await userBelongsToHousehold(user.id, householdId))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }
        return new Response(JSON.stringify({ ok: true, householdId }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": serializeCookie(HOUSEHOLD_COOKIE, householdId, {
              httpOnly: true,
              secure: process.env.SECURE_COOKIES === "true",
              sameSite: "Lax",
              maxAge: 60 * 60 * 24 * 30,
              path: "/",
              domain: process.env.AUTH_DOMAIN || undefined,
            }),
          },
        });
      }),
    },

    // ─── Library ──────────────────────────────────────────────────────────
    "/api/library/summary": {
      GET: requireHousehold(async (_req, { householdId }) =>
        Response.json(await getLibraryCounts(householdId)),
      ),
    },

    "/api/library": {
      GET: requireHousehold(async (_req, { householdId }) =>
        Response.json({ items: await listLibrary(householdId) }),
      ),
    },

    "/api/movies/:id": {
      GET: requireHousehold(async (req, { householdId }) => {
        const id = param(req, "id");
        if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
        const movie = await getMovie(householdId, id);
        if (!movie) return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json(movie);
      }),
    },

    "/api/series/:id": {
      GET: requireHousehold(async (req, { householdId }) => {
        const id = param(req, "id");
        if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
        const series = await getSeries(householdId, id);
        if (!series) return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json(series);
      }),
    },

    // ─── Scan ─────────────────────────────────────────────────────────────
    "/api/library/scan": {
      // Latest scan runs for the active household.
      GET: requireHousehold(async (_req, { householdId }) =>
        Response.json({ runs: listScanRunsForHousehold(householdId) }),
      ),
      // Kick off a new scan. Admin only — ffprobe-walking a large library
      // is resource-intensive.
      POST: requireHouseholdAdmin(async (_req, { householdId, user }) => {
        const root = process.env.MEDIA_LIBRARY_PATH;
        if (!root) {
          return Response.json(
            { error: "MEDIA_LIBRARY_PATH not configured" },
            { status: 500 },
          );
        }
        const run = startScan({
          householdId,
          startedByUserId: user.id,
          rootPath: root,
        });
        return Response.json(run, { status: 202 });
      }),
    },

    "/api/library/scan/:id": {
      GET: requireHousehold(async (req, { householdId }) => {
        const id = param(req, "id");
        if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
        const run = getScanRun(id);
        if (!run || run.householdId !== householdId) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        return Response.json(run);
      }),
    },

    "/api/library/enrich": {
      // Manual TMDB enrichment for titles still missing tmdbId. Admin-only
      // because it can issue a few hundred outbound requests on a large
      // library.
      POST: requireHouseholdAdmin(async (_req, { householdId }) => {
        const summary = await enrichHousehold(householdId);
        return Response.json(summary);
      }),
    },

    // ─── Stream (range-aware playback) ────────────────────────────────────
    "/api/stream/:fileId": {
      GET: requireHousehold(streamHandler),
      HEAD: requireHousehold(streamHandler),
    },

    // ─── SPA shell ────────────────────────────────────────────────────────
    "/*": index,
  },

  development:
    process.env.NODE_ENV !== "production" && {
      hmr: true,
      console: true,
    },
});

console.log(`hle-media listening on ${server.url}`);
