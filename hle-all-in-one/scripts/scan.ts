// Headless library scan (port of hle-media/scripts/scan.ts) — the cron /
// first-boot indexing path. Scan-run state in scan-runs.ts is in-memory and
// UI-only; this calls the scanner directly and prints the summary.
//
//   bun scripts/scan.ts <householdId> [rootPath]
//   MEDIA_HOUSEHOLD_ID=… MEDIA_LIBRARY_PATH=… bun scripts/scan.ts
//
// Pass --enrich to run TMDB enrichment afterwards (needs TMDB_API_KEY).
import { sql } from "../src/server/db"
import { scanLibrary } from "../src/server/media/scanner"
import { enrichHousehold } from "../src/server/media/enrichment"
import { tmdbConfigured } from "../src/server/media/tmdb"

const args = process.argv.slice(2).filter((a) => a !== "--enrich")
const enrich = process.argv.includes("--enrich")

const householdId = args[0] ?? process.env.MEDIA_HOUSEHOLD_ID
const rootPath = args[1] ?? process.env.MEDIA_LIBRARY_PATH

if (!householdId || !rootPath) {
  console.error(
    "usage: bun scripts/scan.ts <householdId> [rootPath] [--enrich]"
  )
  console.error(
    "   or: MEDIA_HOUSEHOLD_ID=… MEDIA_LIBRARY_PATH=… bun scripts/scan.ts"
  )
  process.exit(2)
}

// Fail fast on a bad household id — the scanner would otherwise upsert rows
// that violate the Movie/Series householdId FK one file at a time.
const households = await sql<Array<{ id: string }>>`
  SELECT "id" FROM "Household" WHERE "id" = ${householdId}`
if (households.length === 0) {
  console.error(`no such household: ${householdId}`)
  process.exit(2)
}

console.log(`scanning ${rootPath} for household ${householdId}…`)
const summary = await scanLibrary({ householdId, rootPath })
console.log(JSON.stringify(summary, null, 2))

if (enrich) {
  if (!tmdbConfigured()) {
    console.error("--enrich requested but TMDB_API_KEY is not set")
    process.exit(1)
  }
  console.log("enriching…")
  console.log(JSON.stringify(await enrichHousehold(householdId), null, 2))
}

process.exit(summary.errors.length > 0 ? 1 : 0)
