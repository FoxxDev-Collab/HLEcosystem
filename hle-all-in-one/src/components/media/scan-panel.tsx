import { useEffect, useRef, useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  enrichLibraryFn,
  listScanRunsFn,
  startScanFn,
} from "@/server/media/fns.scan"
import type { ScanRun } from "@/server/media/scan-runs"

const STATUS_VARIANT: Record<
  ScanRun["status"],
  "default" | "secondary" | "destructive"
> = {
  running: "secondary",
  enriching: "secondary",
  completed: "default",
  error: "destructive",
}

function runIsActive(run: ScanRun): boolean {
  return run.status === "running" || run.status === "enriching"
}

function summarize(run: ScanRun): string {
  const parts: Array<string> = []
  if (run.summary) {
    const s = run.summary
    parts.push(
      `${s.filesSeen} seen · ${s.filesIndexed} indexed · ${s.filesSkipped} skipped`,
      `+${s.moviesAdded} movies · +${s.episodesAdded} episodes`
    )
    if (s.errors.length > 0) parts.push(`${s.errors.length} errors`)
  }
  if (run.enrichment) {
    const e = run.enrichment
    parts.push(
      e.skipped
        ? "enrichment skipped (TMDB not configured)"
        : `enriched ${e.moviesEnriched}/${e.moviesAttempted} movies, ${e.seriesEnriched}/${e.seriesAttempted} series`
    )
  }
  if (run.error) parts.push(run.error)
  return parts.join(" — ")
}

// Admin-only scan/enrich controls with live run status. Polls while a run is
// active and invalidates the library loader when one finishes.
export function ScanPanel({
  initialRuns,
  onLibraryChanged,
}: {
  initialRuns: Array<ScanRun>
  onLibraryChanged: () => void
}) {
  const [runs, setRuns] = useState<Array<ScanRun>>(initialRuns)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const hadActive = useRef(initialRuns.some(runIsActive))

  const anyActive = runs.some(runIsActive)

  useEffect(() => {
    if (!anyActive) return
    const timer = setInterval(() => {
      listScanRunsFn()
        .then((next) => {
          setRuns(next)
          const stillActive = next.some(runIsActive)
          if (hadActive.current && !stillActive) onLibraryChanged()
          hadActive.current = stillActive
        })
        .catch(() => {
          /* transient poll failure — next tick retries */
        })
    }, 2500)
    return () => clearInterval(timer)
  }, [anyActive, onLibraryChanged])

  async function triggerScan() {
    setPending(true)
    setMessage(null)
    try {
      const result = await startScanFn()
      if ("error" in result && typeof result.error === "string") {
        setMessage(result.error)
      } else if ("run" in result && result.run) {
        const run = result.run
        setMessage(`Scan started (${run.id.slice(0, 8)}…)`)
        setRuns((prev) => [run, ...prev])
        hadActive.current = true
      }
    } catch {
      setMessage("Could not start the scan.")
    } finally {
      setPending(false)
    }
  }

  async function triggerEnrich() {
    setPending(true)
    setMessage(null)
    try {
      const result = await enrichLibraryFn()
      if ("error" in result && typeof result.error === "string") {
        setMessage(result.error)
      } else if ("summary" in result && result.summary) {
        const s = result.summary
        setMessage(
          `Enriched ${s.moviesEnriched}/${s.moviesAttempted} movies, ${s.seriesEnriched}/${s.seriesAttempted} series.`
        )
        onLibraryChanged()
      }
    } catch {
      setMessage("Enrichment failed.")
    } finally {
      setPending(false)
    }
  }

  const latest = runs[0]

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || anyActive}
            onClick={triggerScan}
          >
            {anyActive ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {anyActive ? "Scanning…" : "Scan"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || anyActive}
            onClick={triggerEnrich}
          >
            <Sparkles className="size-4" /> Enrich
          </Button>
          {message && (
            <span className="text-xs text-muted-foreground">{message}</span>
          )}
        </div>
        {latest ? (
          <div className="space-y-1">
            {runs.slice(0, 3).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <Badge variant={STATUS_VARIANT[run.status]}>{run.status}</Badge>
                <span className="text-muted-foreground">
                  {new Date(run.startedAt).toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  {summarize(run) || "walking the library…"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No scans this session. Scan walks MEDIA_LIBRARY_PATH, then enriches
            new titles from TMDB.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
