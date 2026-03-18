"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { SetType } from "@prisma/client";

interface ParsedSet {
  setIndex: number;
  setType: string;
  weightLbs: number | null;
  reps: number | null;
  distanceMiles: number | null;
  durationSeconds: number | null;
  rpe: number | null;
}

interface ParsedExercise {
  name: string;
  notes: string;
  supersetId: number | null;
  sets: ParsedSet[];
}

interface ParsedWorkout {
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  exercises: ParsedExercise[];
}

export interface ParseResult {
  workouts: ParsedWorkout[];
  totalExercises: number;
  totalSets: number;
  error?: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// Column name aliases — maps actual CSV column names to our internal names
const COLUMN_ALIASES: Record<string, string> = {
  // Actual CSV columns → internal names
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
};

// Parse datetime strings like "19 Jan 2026, 08:30"
function parseDateTime(str: string): Date | null {
  if (!str) return null;

  // Try ISO format first (2026-01-19T08:30:00 or 2026-01-19)
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime()) && str.includes("-")) return isoDate;

  // Parse "DD Mon YYYY, HH:MM" format
  const match = str.match(
    /(\d{1,2})\s+(\w{3})\s+(\d{4}),?\s*(\d{1,2}):(\d{2})/,
  );
  if (!match) return null;

  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const [, day, mon, year, hour, min] = match;
  const monthIdx = months[mon];
  if (monthIdx === undefined) return null;

  return new Date(
    parseInt(year),
    monthIdx,
    parseInt(day),
    parseInt(hour),
    parseInt(min),
  );
}

// Extract just the date portion for display (YYYY-MM-DD)
function extractDateStr(str: string): string {
  const dt = parseDateTime(str);
  if (!dt) return str;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveColumnIndex(
  header: string[],
  internalName: string,
): number {
  for (let i = 0; i < header.length; i++) {
    const alias = COLUMN_ALIASES[header[i]];
    if (alias === internalName) return i;
  }
  return -1;
}

export async function parseWorkoutCSVAction(
  formData: FormData,
): Promise<ParseResult> {
  const user = await getCurrentUser();
  if (!user)
    return { workouts: [], totalExercises: 0, totalSets: 0, error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file)
    return { workouts: [], totalExercises: 0, totalSets: 0, error: "No file uploaded" };

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2)
    return {
      workouts: [],
      totalExercises: 0,
      totalSets: 0,
      error: "CSV file is empty or has no data rows",
    };

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));

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
  };

  // Must have title and exercise at minimum
  if (col.title === -1 || col.exercise === -1) {
    return {
      workouts: [],
      totalExercises: 0,
      totalSets: 0,
      error:
        "CSV must have Title and Exercise (or exercise_title) columns. " +
        `Found columns: ${header.join(", ")}`,
    };
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
    };
  }

  const workoutMap = new Map<string, ParsedWorkout>();
  let totalSets = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const title = fields[col.title] || "";
    const exerciseName = fields[col.exercise] || "";
    if (!title || !exerciseName) continue;

    // Determine date and times
    const rawStartTime = col.startTime >= 0 ? (fields[col.startTime] || "") : "";
    const rawEndTime = col.endTime >= 0 ? (fields[col.endTime] || "") : "";
    const rawDate = col.date >= 0 ? (fields[col.date] || "") : "";
    const dateStr = rawDate || extractDateStr(rawStartTime);
    if (!dateStr) continue;

    // Group key: title + start_time (if available) or title + date
    const key = rawStartTime ? `${title}|${rawStartTime}` : `${title}|${dateStr}`;

    if (!workoutMap.has(key)) {
      workoutMap.set(key, {
        date: dateStr,
        title,
        startTime: rawStartTime,
        endTime: rawEndTime,
        description: col.description >= 0 ? (fields[col.description] || "") : "",
        exercises: [],
      });
    }
    const workout = workoutMap.get(key)!;

    // Find or create exercise entry
    let exercise = workout.exercises.find((e) => e.name === exerciseName);
    if (!exercise) {
      const notesStr = col.notes >= 0 ? (fields[col.notes] || "") : "";
      const supersetStr = col.supersetId >= 0 ? (fields[col.supersetId] || "") : "";
      exercise = {
        name: exerciseName,
        notes: notesStr,
        supersetId: supersetStr ? parseInt(supersetStr) || null : null,
        sets: [],
      };
      workout.exercises.push(exercise);
    }

    // Parse set data
    const rawSetType = col.setType >= 0 ? (fields[col.setType] || "").toUpperCase() : "";
    const validTypes = ["NORMAL", "WARMUP", "FAILURE", "DROPSET"];
    const setType = validTypes.includes(rawSetType) ? rawSetType : "NORMAL";

    const setIdxStr = col.setIndex >= 0 ? fields[col.setIndex] : "";
    const setIdx = setIdxStr ? parseInt(setIdxStr) : exercise.sets.length;

    const weightStr = col.weight >= 0 ? fields[col.weight] : "";
    const repsStr = col.reps >= 0 ? fields[col.reps] : "";
    const distStr = col.distance >= 0 ? fields[col.distance] : "";
    const durStr = col.duration >= 0 ? fields[col.duration] : "";
    const rpeStr = col.rpe >= 0 ? fields[col.rpe] : "";

    exercise.sets.push({
      setIndex: setIdx,
      setType,
      weightLbs: weightStr ? parseFloat(weightStr) || null : null,
      reps: repsStr ? parseInt(repsStr) || null : null,
      distanceMiles: distStr ? parseFloat(distStr) || null : null,
      durationSeconds: durStr ? parseInt(durStr) || null : null,
      rpe: rpeStr ? parseFloat(rpeStr) || null : null,
    });
    totalSets++;
  }

  const workouts = [...workoutMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const totalExercises = workouts.reduce(
    (s, w) => s + w.exercises.length,
    0,
  );

  return { workouts, totalExercises, totalSets };
}

export async function importWorkoutsAction(
  formData: FormData,
): Promise<{ success: boolean; imported: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, imported: 0, error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { success: false, imported: 0, error: "No household" };

  const familyMemberId = formData.get("familyMemberId") as string;
  const dataStr = formData.get("data") as string;

  if (!familyMemberId || !dataStr) {
    return { success: false, imported: 0, error: "Missing required fields" };
  }

  const member = await prisma.familyMember.findFirst({
    where: { id: familyMemberId, householdId },
  });
  if (!member) {
    return { success: false, imported: 0, error: "Family member not found" };
  }

  let workouts: ParsedWorkout[];
  try {
    workouts = JSON.parse(dataStr);
  } catch {
    return { success: false, imported: 0, error: "Invalid data format" };
  }

  let imported = 0;

  for (const w of workouts) {
    // Use actual start/end times if available, fall back to date with 08:00
    const startTime = parseDateTime(w.startTime) ?? new Date(`${w.date}T08:00:00`);
    const endTime = parseDateTime(w.endTime) ?? null;

    await prisma.workout.create({
      data: {
        familyMemberId,
        title: w.title,
        startTime,
        endTime,
        description: w.description || null,
        exercises: {
          create: w.exercises.map((ex, exIdx) => ({
            exerciseName: ex.name,
            orderIndex: exIdx,
            notes: ex.notes || null,
            supersetGroupId: ex.supersetId,
            sets: {
              create: ex.sets.map((set) => ({
                setIndex: set.setIndex,
                setType: (set.setType as SetType) || "NORMAL",
                weightLbs: set.weightLbs,
                reps: set.reps,
                distanceMiles: set.distanceMiles,
                durationSeconds: set.durationSeconds,
                rpe: set.rpe,
              })),
            },
          })),
        },
      },
    });
    imported++;
  }

  revalidatePath("/workouts");
  return { success: true, imported };
}
