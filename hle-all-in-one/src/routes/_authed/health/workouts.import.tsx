import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  FileUp,
  Upload,
} from "lucide-react"
import {
  getHealthMembersFn,
  importWorkoutsFn,
  parseWorkoutCsvFn,
} from "@/server/health/fns.workouts"
import type { ParseResult } from "@/server/health/workouts-import"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { selectClass } from "@/components/health/health-shared"

export const Route = createFileRoute("/_authed/health/workouts/import")({
  loader: () => getHealthMembersFn(),
  component: ImportWorkoutsPage,
})

// Matches the 5MB server-side zod bound on the raw CSV string.
const MAX_CSV_BYTES = 5 * 1024 * 1024

const SAMPLE_CSV = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe
"Leg","19 Jan 2026, 08:30","19 Jan 2026, 10:25","","Squat (Barbell)",,"",,warmup,,5,,,
"Leg","19 Jan 2026, 08:30","19 Jan 2026, 10:25","","Squat (Barbell)",,"",1,normal,225,3,,,
"Leg","19 Jan 2026, 08:30","19 Jan 2026, 10:25","","Running",,"",0,normal,,,0.53,540,`

function ImportWorkoutsPage() {
  const members = Route.useLoaderData()
  const [memberId, setMemberId] = useState(members[0]?.id ?? "")
  const [pasted, setPasted] = useState("")
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<
    | { success: true; imported: number }
    | { success: false; error: string }
    | null
  >(null)
  const [showHelp, setShowHelp] = useState(false)

  async function onPreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)
    setPreview(null)
    setParsing(true)
    const f = new FormData(e.currentTarget)
    try {
      // Prefer the uploaded file; fall back to pasted CSV text. The file is
      // only read as text here — all parsing and validation happen on the
      // server, which never sees (or trusts) the client-reported file type.
      const file = f.get("file")
      let csv = pasted.trim()
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_CSV_BYTES) {
          setPreview({
            workouts: [],
            totalExercises: 0,
            totalSets: 0,
            error: "File is too large (5MB max).",
          })
          setParsing(false)
          return
        }
        csv = await file.text()
      }
      if (!csv) {
        setPreview({
          workouts: [],
          totalExercises: 0,
          totalSets: 0,
          error: "Choose a CSV file or paste CSV text first.",
        })
        setParsing(false)
        return
      }
      const res = await parseWorkoutCsvFn({ data: { csv } })
      setPreview(res)
    } catch {
      setPreview({
        workouts: [],
        totalExercises: 0,
        totalSets: 0,
        error: "Could not parse the CSV.",
      })
    }
    setParsing(false)
  }

  async function onImport() {
    if (!preview || preview.workouts.length === 0) return
    setImporting(true)
    setResult(null)
    try {
      const res = await importWorkoutsFn({
        data: { memberId, workouts: preview.workouts },
      })
      if ("error" in res && typeof res.error === "string") {
        setResult({ success: false, error: res.error })
      } else if ("imported" in res) {
        setResult({ success: true, imported: res.imported })
        setPreview(null)
        setPasted("")
      }
    } catch {
      setResult({ success: false, error: "Import failed." })
    }
    setImporting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          render={<Link to="/health/workouts" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Import Workouts</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file to bulk import workout data
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Enable health tracking for a family member first to import workouts.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="size-5" /> Upload CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onPreview} className="space-y-4">
              <div className="grid items-end gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="import-member">Family Member</Label>
                  <select
                    id="import-member"
                    className={selectClass}
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    required
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-file">CSV File</Label>
                  <Input
                    id="import-file"
                    name="file"
                    type="file"
                    accept=".csv"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-paste">Or paste CSV text</Label>
                <Textarea
                  id="import-paste"
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="title,start_time,exercise_title,..."
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={parsing}>
                <Upload className="size-4" />
                {parsing ? "Parsing…" : "Preview"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowHelp(!showHelp)}
        >
          <CardTitle className="flex items-center justify-between text-sm">
            CSV Format Help
            {showHelp ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </CardTitle>
        </CardHeader>
        {showHelp && (
          <CardContent>
            <CardDescription className="mb-3">
              Supports workout tracker exports (e.g. Strong) with columns:
              title, start_time, end_time, description, exercise_title,
              exercise_notes, set_index, set_type, weight_lbs, reps,
              distance_miles, duration_seconds, rpe
            </CardDescription>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {SAMPLE_CSV}
            </pre>
            <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>
                Rows with the same Title + start_time are grouped into one
                workout
              </li>
              <li>
                Rows with the same exercise_title within a workout are grouped
                together
              </li>
              <li>
                set_type: normal, warmup, failure, or dropset (defaults to
                normal)
              </li>
              <li>
                start_time/end_time: actual workout times (e.g. &quot;19 Jan
                2026, 08:30&quot;)
              </li>
              <li>
                weight_lbs, distance_miles, duration_seconds — units in column
                names
              </li>
              <li>exercise_notes are preserved per exercise</li>
              <li>RPE scale 1-10 (optional)</li>
              <li>Leave fields empty if not applicable</li>
            </ul>
          </CardContent>
        )}
      </Card>

      {preview?.error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{preview.error}</p>
          </CardContent>
        </Card>
      )}

      {preview && !preview.error && preview.workouts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview</CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {preview.workouts.length} workout
                  {preview.workouts.length !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary">
                  {preview.totalExercises} exercise
                  {preview.totalExercises !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary">
                  {preview.totalSets} set{preview.totalSets !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.workouts.map((w, wi) => (
              <div key={wi} className="rounded-lg border p-3">
                <div className="font-medium">
                  {w.title}{" "}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {w.date}
                  </span>
                  {w.startTime && w.endTime && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({w.startTime} — {w.endTime})
                    </span>
                  )}
                </div>
                {w.description && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {w.description}
                  </div>
                )}
                <div className="mt-2 space-y-2">
                  {w.exercises.map((ex, ei) => (
                    <div key={ei} className="pl-4">
                      <div className="text-sm font-medium text-muted-foreground">
                        {ex.name}{" "}
                        <span className="text-xs">
                          ({ex.sets.length} set
                          {ex.sets.length !== 1 ? "s" : ""})
                        </span>
                        {ex.notes && (
                          <span className="ml-1 text-xs italic">
                            — {ex.notes}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 space-x-3 text-xs text-muted-foreground">
                        {ex.sets.map((set, si) => {
                          const parts: Array<string> = []
                          if (set.weightLbs) parts.push(`${set.weightLbs}lbs`)
                          if (set.reps) parts.push(`x${set.reps}`)
                          if (set.distanceMiles)
                            parts.push(`${set.distanceMiles}mi`)
                          if (set.durationSeconds)
                            parts.push(`${set.durationSeconds}s`)
                          if (set.setType !== "NORMAL")
                            parts.push(`[${set.setType}]`)
                          return (
                            <span key={si}>
                              {parts.join(" ") || "empty set"}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Button
              onClick={onImport}
              disabled={importing || !memberId}
              className="w-full"
            >
              <Check className="size-4" />
              {importing
                ? "Importing…"
                : `Import All (${preview.workouts.length} workout${
                    preview.workouts.length !== 1 ? "s" : ""
                  })`}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card
          className={result.success ? "border-green-500" : "border-destructive"}
        >
          <CardContent className="py-4">
            {result.success ? (
              <p className="text-sm text-green-600">
                Successfully imported {result.imported} workout
                {result.imported !== 1 ? "s" : ""}.{" "}
                <Link to="/health/workouts" className="font-medium underline">
                  View workouts
                </Link>
              </p>
            ) : (
              <p className="text-sm text-destructive">{result.error}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
