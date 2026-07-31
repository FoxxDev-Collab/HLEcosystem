// Scan + enrichment server fns.
//
// Env vars:
// * MEDIA_LIBRARY_PATH — root directory the scanner walks (same name as the
//   legacy hle-media app). Scans fail fast with { error } when unset; the
//   scanner never receives a request-supplied path.
// * TMDB_API_KEY — optional TMDB v3 key for metadata enrichment. When unset,
//   manual enrichment returns { error: "TMDB not configured" } and the
//   post-scan enrichment pass marks itself skipped.
import { createServerFn } from "@tanstack/react-start"
import { householdMiddleware } from "@/server/middleware"
import { canManageHousehold } from "@/server/privileges"
import { enrichHousehold } from "./enrichment"
import { listScanRunsForHousehold, startScan } from "./scan-runs"
import { tmdbConfigured } from "./tmdb"

// Any household member may watch scan progress (legacy parity)…
export const listScanRunsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(({ context }) => listScanRunsForHousehold(context.householdId))

// …but starting one is household-privileged (OWNER or instance ADMIN, same
// rule as legacy's household-admin check): ffprobe-walking a large library
// is resource-intensive.
export const startScanFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(({ context }) => {
    if (!canManageHousehold(context)) {
      return { error: "Only the household owner can start a scan." }
    }
    const root = process.env.MEDIA_LIBRARY_PATH
    if (!root) {
      return { error: "MEDIA_LIBRARY_PATH not configured" }
    }
    const run = startScan({
      householdId: context.householdId,
      startedByUserId: context.user.id,
      rootPath: root,
    })
    return { run }
  })

// Manual TMDB enrichment for titles still missing tmdbId. Household-privileged
// because it can issue a few hundred outbound requests on a large library.
export const enrichLibraryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    if (!canManageHousehold(context)) {
      return { error: "Only the household owner can run enrichment." }
    }
    if (!tmdbConfigured()) {
      return { error: "TMDB not configured" }
    }
    const summary = await enrichHousehold(context.householdId)
    return { summary }
  })
