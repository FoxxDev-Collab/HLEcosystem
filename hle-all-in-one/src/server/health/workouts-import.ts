// Strong-app workout CSV importer — faithful port of the legacy hand-rolled
// quoted-CSV parser from hle-family_health/app/(app)/workouts/import/actions.ts.
// Parsing runs on the server inside a zod-validated server fn (bounded input).
import { sql } from "@/server/db"
import type { SetType } from "./workouts"

export type ParsedSet = {
  setIndex: number
  setType: SetType
  weightLbs: number | null
  reps: number | null
  distanceMiles: number | null
  durationSeconds: number | null
  rpe: number | null
}

export type ParsedExercise = {
  name: string
  notes: string
  supersetId: number | null
  sets: Array<ParsedSet>
}

export type ParsedWorkout = {
  date: string
  title: string
  startTime: string
  endTime: string
  description: string
  exercises: Array<ParsedExercise>
}

export type ParseResult = {
  workouts: Array<ParsedWorkout>
  totalExercises: number
  totalSets: number
  error?: string
}

function parseCSVLine(line: string): Array<string> {
  const fields: Array<string> = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        fields.push(current.trim())
        current = ""
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

// Column name aliases — maps actual CSV column names to our internal names.
const COLUMN_ALIASES: Record<string, string> = {
  // Strong-app export columns → internal names
  exercise_title: "exercise",
  start_time: "starttime",
  end_time: "endtime",
  set_type: "settype",
  weight_lbs: "weight",
  distance_miles: "distance",
  duration_seconds: "duration",
  exercise_notes: "notes",
  superset_id: "supersetid",
  set_index: "setindex",
  // Simple format passthrough (already lowercase from header normalization)
  date: "date",
  title: "title",
  exercise: "exercise",
  settype: "settype",
  weight: "weight",
  reps: "reps",
  distance: "distance",
  duration: "duration",
  rpe: "rpe",
  description: "description",
}

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

// Parse datetime strings like "19 Jan 2026, 08:30" or ISO dates.
export function parseImportDateTime(str: string): Date | null {
  if (!str) return null

  // Try ISO format first (2026-01-19T08:30:00 or 2026-01-19)
  const isoDate = new Date(str)
  if (!isNaN(isoDate.getTime()) && str.includes("-")) return isoDate

  // Parse "DD Mon YYYY, HH:MM" format
  const match = str.match(/(\d{1,2})\s+(\w{3})\s+(\d{4}),?\s*(\d{1,2}):(\d{2})/)
  if (!match) return null

  const [, day, mon, year, hour, min] = match
  const monthIdx = MONTHS[mon]
  if (monthIdx === undefined) return null

  return new Date(
    parseInt(year),
    monthIdx,
    parseInt(day),
    parseInt(hour),
    parseInt(min)
  )
}

// Extract just the date portion for display (YYYY-MM-DD).
function extractDateStr(str: string): string {
  const dt = parseImportDateTime(str)
  if (!dt) return str
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function resolveColumnIndex(
  header: Array<string>,
  internalName: string
): number {
  for (let i = 0; i < header.length; i++) {
    const alias = COLUMN_ALIASES[header[i]]
    if (alias === internalName) return i
  }
  return -1
}

// `parseFloat("0") || null` → null matches legacy semantics (zero and
// unparsable values both become null); NaN is normalized away.
function floatOrNull(str: string): number | null {
  if (!str) return null
  const n = parseFloat(str)
  return Number.isFinite(n) && n !== 0 ? n : null
}

function intOrNull(str: string): number | null {
  if (!str) return null
  const n = parseInt(str)
  return Number.isFinite(n) && n !== 0 ? n : null
}

export function parseWorkoutCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    return {
      workouts: [],
      totalExercises: 0,
      totalSets: 0,
      error: "CSV file is empty or has no data rows",
    }
  }

  const header = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_")
  )

  // Resolve all column indices through alias mapping
  const col = {
    title: resolveColumnIndex(header, "title"),
    exercise: resolveColumnIndex(header, "exercise"),
    startTime: resolveColumnIndex(header, "starttime"),
    endTime: resolveColumnIndex(header, "endtime"),
    date: resolveColumnIndex(header, "date"),
    setType: resolveColumnIndex(header, "settype"),
    weight: resolveColumnIndex(header, "weight"),
    reps: resolveColumnIndex(header, "reps"),
    distance: resolveColumnIndex(header, "distance"),
    duration: resolveColumnIndex(header, "duration"),
    rpe: resolveColumnIndex(header, "rpe"),
    description: resolveColumnIndex(header, "description"),
    notes: resolveColumnIndex(header, "notes"),
    supersetId: resolveColumnIndex(header, "supersetid"),
    setIndex: resolveColumnIndex(header, "setindex"),
  }

  // Must have title and exercise at minimum
  if (col.title === -1 || col.exercise === -1) {
    return {
      workouts: [],
      totalExercises: 0,
      totalSets: 0,
      error:
        "CSV must have Title and Exercise (or exercise_title) columns. " +
        `Found columns: ${header.join(", ")}`,
    }
  }

  // Need either a date column or start_time column
  if (col.date === -1 && col.startTime === -1) {
    return {
      workouts: [],
      totalExercises: 0,
      totalSets: 0,
      error:
        "CSV must have a Date or start_time column. " +
        `Found columns: ${header.join(", ")}`,
    }
  }

  const workoutMap = new Map<string, ParsedWorkout>()
  let totalSets = 0

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    const title = fields[col.title] || ""
    const exerciseName = fields[col.exercise] || ""
    if (!title || !exerciseName) continue

    // Determine date and times
    const rawStartTime = col.startTime >= 0 ? fields[col.startTime] || "" : ""
    const rawEndTime = col.endTime >= 0 ? fields[col.endTime] || "" : ""
    const rawDate = col.date >= 0 ? fields[col.date] || "" : ""
    const dateStr = rawDate || extractDateStr(rawStartTime)
    if (!dateStr) continue

    // Group key: title + start_time (if available) or title + date —
    // rows sharing a key merge into one workout (dedupe semantics).
    const key = rawStartTime
      ? `${title}|${rawStartTime}`
      : `${title}|${dateStr}`

    let workout = workoutMap.get(key)
    if (!workout) {
      workout = {
        date: dateStr,
        title,
        startTime: rawStartTime,
        endTime: rawEndTime,
        description: col.description >= 0 ? fields[col.description] || "" : "",
        exercises: [],
      }
      workoutMap.set(key, workout)
    }

    // Find or create exercise entry — same exercise_title within a workout
    // groups its rows as sets of one exercise.
    let exercise = workout.exercises.find((e) => e.name === exerciseName)
    if (!exercise) {
      const notesStr = col.notes >= 0 ? fields[col.notes] || "" : ""
      const supersetStr =
        col.supersetId >= 0 ? fields[col.supersetId] || "" : ""
      exercise = {
        name: exerciseName,
        notes: notesStr,
        supersetId: intOrNull(supersetStr),
        sets: [],
      }
      workout.exercises.push(exercise)
    }

    // Parse set data
    const rawSetType =
      col.setType >= 0 ? (fields[col.setType] || "").toUpperCase() : ""
    const validTypes: Array<SetType> = [
      "NORMAL",
      "WARMUP",
      "FAILURE",
      "DROPSET",
    ]
    const setType =
      validTypes.find((t) => t === rawSetType) ?? ("NORMAL" as const)

    const setIdxStr = col.setIndex >= 0 ? fields[col.setIndex] || "" : ""
    const parsedIdx = setIdxStr ? parseInt(setIdxStr) : NaN
    const setIdx = Number.isFinite(parsedIdx) ? parsedIdx : exercise.sets.length

    exercise.sets.push({
      setIndex: setIdx,
      setType,
      weightLbs: floatOrNull(col.weight >= 0 ? fields[col.weight] || "" : ""),
      reps: intOrNull(col.reps >= 0 ? fields[col.reps] || "" : ""),
      distanceMiles: floatOrNull(
        col.distance >= 0 ? fields[col.distance] || "" : ""
      ),
      durationSeconds: intOrNull(
        col.duration >= 0 ? fields[col.duration] || "" : ""
      ),
      rpe: floatOrNull(col.rpe >= 0 ? fields[col.rpe] || "" : ""),
    })
    totalSets++
  }

  const workouts = [...workoutMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  const totalExercises = workouts.reduce((s, w) => s + w.exercises.length, 0)

  return { workouts, totalExercises, totalSets }
}

// Insert parsed workouts for a member (ownership verified by the caller).
export async function importParsedWorkouts(
  memberId: string,
  workouts: Array<ParsedWorkout>
): Promise<number> {
  let imported = 0
  for (const w of workouts) {
    // Use actual start/end times if available, fall back to date with 08:00
    const startTime =
      parseImportDateTime(w.startTime) ?? new Date(`${w.date}T08:00:00`)
    if (isNaN(startTime.getTime())) continue
    const endTime = parseImportDateTime(w.endTime)

    const [workout] = await sql<Array<{ id: string }>>`
      INSERT INTO "Workout" ("memberId", "title", "startTime", "endTime", "description")
      VALUES (${memberId}, ${w.title}, ${startTime}, ${endTime},
              ${w.description || null})
      RETURNING "id"`

    for (let exIdx = 0; exIdx < w.exercises.length; exIdx++) {
      const ex = w.exercises[exIdx]
      const [exercise] = await sql<Array<{ id: string }>>`
        INSERT INTO "WorkoutExercise"
          ("workoutId", "exerciseName", "orderIndex", "supersetGroupId", "notes")
        VALUES (${workout.id}, ${ex.name}, ${exIdx}, ${ex.supersetId},
                ${ex.notes || null})
        RETURNING "id"`

      for (const set of ex.sets) {
        await sql`
          INSERT INTO "ExerciseSet"
            ("workoutExerciseId", "setIndex", "setType", "weightLbs", "reps",
             "distanceMiles", "durationSeconds", "rpe")
          VALUES (${exercise.id}, ${set.setIndex}, ${set.setType}::"SetType",
                  ${set.weightLbs}, ${set.reps}, ${set.distanceMiles},
                  ${set.durationSeconds}, ${set.rpe})`
      }
    }
    imported++
  }
  return imported
}
