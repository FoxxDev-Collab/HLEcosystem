"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, FileUp, Check, ChevronDown, ChevronUp } from "lucide-react";
import {
  parseWorkoutCSVAction,
  importWorkoutsAction,
  type ParseResult,
} from "./actions";

interface Member {
  id: string;
  firstName: string;
}

export function ImportClient({ members }: { members: Member[] }) {
  const [memberId, setMemberId] = useState(members[0]?.id || "");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    error?: string;
  } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function handlePreview(formData: FormData) {
    setParsing(true);
    setResult(null);
    const res = await parseWorkoutCSVAction(formData);
    setPreview(res);
    setParsing(false);
  }

  async function handleImport() {
    if (!preview || preview.workouts.length === 0) return;
    setImporting(true);
    const fd = new FormData();
    fd.set("familyMemberId", memberId);
    fd.set("data", JSON.stringify(preview.workouts));
    const res = await importWorkoutsAction(fd);
    setResult(res);
    setImporting(false);
    if (res.success) setPreview(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workouts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Workouts</h1>
          <p className="text-muted-foreground">
            Upload a CSV file to bulk import workout data
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="size-5" /> Upload CSV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handlePreview} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 items-end">
              <div className="space-y-2">
                <Label>Family Member</Label>
                <Select
                  name="familyMemberId"
                  value={memberId}
                  onValueChange={setMemberId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CSV File</Label>
                <Input name="file" type="file" accept=".csv" required />
              </div>
            </div>
            <Button type="submit" disabled={parsing}>
              <Upload className="size-4 mr-2" />
              {parsing ? "Parsing..." : "Preview"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* CSV Format Help */}
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
              Supports workout tracker exports with columns: title,
              start_time, end_time, description, exercise_title,
              exercise_notes, set_index, set_type, weight_lbs, reps,
              distance_miles, duration_seconds, rpe
            </CardDescription>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe
"Leg","19 Jan 2026, 08:30","19 Jan 2026, 10:25","","Squat (Barbell)",,"",,warmup,,5,,,
"Leg","19 Jan 2026, 08:30","19 Jan 2026, 10:25","","Squat (Barbell)",,"",1,normal,225,3,,,
"Leg","19 Jan 2026, 08:30","19 Jan 2026, 10:25","","Running",,"",0,normal,,,0.53,540,`}
            </pre>
            <ul className="text-xs text-muted-foreground mt-3 space-y-1 list-disc list-inside">
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
              <li>weight_lbs, distance_miles, duration_seconds — units in column names</li>
              <li>exercise_notes are preserved per exercise</li>
              <li>RPE scale 1-10 (optional)</li>
              <li>Leave fields empty if not applicable</li>
            </ul>
          </CardContent>
        )}
      </Card>

      {/* Error */}
      {preview?.error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{preview.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
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
              <div key={wi} className="border rounded-lg p-3">
                <div className="font-medium">
                  {w.title}{" "}
                  <span className="text-muted-foreground text-sm ml-2">
                    {w.date}
                  </span>
                  {w.startTime && w.endTime && (
                    <span className="text-muted-foreground text-xs ml-2">
                      ({w.startTime} — {w.endTime})
                    </span>
                  )}
                </div>
                {w.description && (
                  <div className="text-xs text-muted-foreground mt-1">{w.description}</div>
                )}
                <div className="mt-2 space-y-2">
                  {w.exercises.map((ex, ei) => (
                    <div key={ei} className="pl-4">
                      <div className="text-sm font-medium text-muted-foreground">
                        {ex.name}{" "}
                        <span className="text-xs">
                          ({ex.sets.length} set{ex.sets.length !== 1 ? "s" : ""})
                        </span>
                        {ex.notes && (
                          <span className="text-xs italic ml-1">— {ex.notes}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                        {ex.sets.map((set, si) => {
                          const parts: string[] = [];
                          if (set.weightLbs)
                            parts.push(`${set.weightLbs}lbs`);
                          if (set.reps) parts.push(`x${set.reps}`);
                          if (set.distanceMiles)
                            parts.push(`${set.distanceMiles}mi`);
                          if (set.durationSeconds)
                            parts.push(`${set.durationSeconds}s`);
                          if (set.setType !== "NORMAL")
                            parts.push(`[${set.setType}]`);
                          return (
                            <span key={si}>
                              {parts.join(" ") || "empty set"}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full"
            >
              <Check className="size-4 mr-2" />
              {importing
                ? "Importing..."
                : `Import All (${preview.workouts.length} workout${preview.workouts.length !== 1 ? "s" : ""})`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className={result.success ? "border-green-500" : "border-destructive"}>
          <CardContent className="py-4">
            {result.success ? (
              <p className="text-green-600 text-sm">
                Successfully imported {result.imported} workout
                {result.imported !== 1 ? "s" : ""}.{" "}
                <Link href="/workouts" className="underline font-medium">
                  View workouts
                </Link>
              </p>
            ) : (
              <p className="text-destructive text-sm">{result.error}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
