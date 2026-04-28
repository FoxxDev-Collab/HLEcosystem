import { randomUUID } from "node:crypto";
import { scanLibrary, type ScanSummary } from "./scanner";
import { enrichHousehold, type EnrichmentSummary } from "./enrichment";

export type ScanRun = {
  id: string;
  householdId: string;
  startedByUserId: string;
  status: "running" | "enriching" | "completed" | "error";
  summary: ScanSummary | null;
  enrichment: EnrichmentSummary | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

// In-memory only. Lost on restart, which is fine — scans are user-triggered
// and can be re-run trivially. Keeps state simple; no schema needed.
const runs = new Map<string, ScanRun>();

// Soft cap so a long-lived process can't accumulate forever.
const MAX_RETAINED = 50;

function evictIfNeeded() {
  if (runs.size <= MAX_RETAINED) return;
  // Drop the oldest by startedAt.
  let oldestId: string | null = null;
  let oldestAt = Infinity;
  for (const [id, run] of runs) {
    const t = Date.parse(run.startedAt);
    if (t < oldestAt) {
      oldestAt = t;
      oldestId = id;
    }
  }
  if (oldestId) runs.delete(oldestId);
}

export function startScan(opts: {
  householdId: string;
  startedByUserId: string;
  rootPath: string;
}): ScanRun {
  const id = randomUUID();
  const run: ScanRun = {
    id,
    householdId: opts.householdId,
    startedByUserId: opts.startedByUserId,
    status: "running",
    summary: null,
    enrichment: null,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  runs.set(id, run);
  evictIfNeeded();

  // Fire-and-forget: scan, then run TMDB enrichment for any newly-found
  // titles. Enrichment failures don't fail the scan — the user can always
  // re-trigger /api/library/enrich.
  (async () => {
    try {
      run.summary = await scanLibrary({
        householdId: opts.householdId,
        rootPath: opts.rootPath,
      });
      run.status = "enriching";
      try {
        run.enrichment = await enrichHousehold(opts.householdId);
      } catch (err) {
        console.warn("[scan] enrichment failed:", err);
      }
      run.status = "completed";
    } catch (err) {
      run.error = err instanceof Error ? err.message : String(err);
      run.status = "error";
      console.error("[scan] failed:", err);
    } finally {
      run.finishedAt = new Date().toISOString();
    }
  })();

  return run;
}

export function getScanRun(id: string): ScanRun | null {
  return runs.get(id) ?? null;
}

export function listScanRunsForHousehold(householdId: string): ScanRun[] {
  return [...runs.values()]
    .filter((r) => r.householdId === householdId)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}
