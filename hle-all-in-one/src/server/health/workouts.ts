import { sql } from "@/server/db"

export type SetType = "NORMAL" | "WARMUP" | "FAILURE" | "DROPSET"

export type HealthMemberOption = {
  id: string
  firstName: string
  lastName: string
}

export type WorkoutListRow = {
  id: string
  memberId: string
  memberFirstName: string
  title: string
  startTime: Date
  endTime: Date | null
  exerciseCount: number
  setCount: number
  totalVolume: number
}

export type WorkoutRow = {
  id: string
  memberId: string
  memberFirstName: string
  title: string
  startTime: Date
  endTime: Date | null
  description: string | null
}

export type ExerciseSetRow = {
  id: string
  workoutExerciseId: string
  setIndex: number
  setType: SetType
  weightLbs: number | null
  reps: number | null
  distanceMiles: number | null
  durationSeconds: number | null
  rpe: number | null
}

export type WorkoutExerciseRow = {
  id: string
  workoutId: string
  exerciseName: string
  orderIndex: number
  supersetGroupId: number | null
  notes: string | null
  sets: Array<ExerciseSetRow>
}

// Member picker for workouts — active HealthMembers only (legacy listed
// active health-tracked members).
export async function listHealthMembers(
  householdId: string
): Promise<Array<HealthMemberOption>> {
  return sql<Array<HealthMemberOption>>`
    SELECT "id", "firstName", "lastName"
    FROM "HealthMember"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "firstName" ASC, "lastName" ASC`
}

// Ownership re-check before mutating by a client-supplied member id.
export async function healthMemberBelongsToHousehold(
  householdId: string,
  memberId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "HealthMember"
    WHERE "id" = ${memberId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

export async function listWorkouts(
  householdId: string,
  memberId: string | null
): Promise<Array<WorkoutListRow>> {
  return sql<Array<WorkoutListRow>>`
    SELECT w."id", w."memberId", m."firstName" AS "memberFirstName",
           w."title", w."startTime", w."endTime",
           (SELECT COUNT(*)::int FROM "WorkoutExercise" e
             WHERE e."workoutId" = w."id") AS "exerciseCount",
           (SELECT COUNT(*)::int FROM "ExerciseSet" s
             JOIN "WorkoutExercise" e ON e."id" = s."workoutExerciseId"
             WHERE e."workoutId" = w."id") AS "setCount",
           COALESCE((SELECT SUM(COALESCE(s."weightLbs", 0) * COALESCE(s."reps", 0))
             FROM "ExerciseSet" s
             JOIN "WorkoutExercise" e ON e."id" = s."workoutExerciseId"
             WHERE e."workoutId" = w."id"), 0)::float8 AS "totalVolume"
    FROM "Workout" w
    JOIN "HealthMember" m ON m."id" = w."memberId"
    WHERE m."householdId" = ${householdId}
      AND (${memberId}::uuid IS NULL OR w."memberId" = ${memberId}::uuid)
    ORDER BY w."startTime" DESC
    LIMIT 50`
}

export async function getWorkout(
  householdId: string,
  id: string
): Promise<WorkoutRow | null> {
  const rows = await sql<Array<WorkoutRow>>`
    SELECT w."id", w."memberId", m."firstName" AS "memberFirstName",
           w."title", w."startTime", w."endTime", w."description"
    FROM "Workout" w
    JOIN "HealthMember" m ON m."id" = w."memberId"
    WHERE w."id" = ${id} AND m."householdId" = ${householdId}`
  return rows[0] ?? null
}

// Exercises + sets for a workout, nested. ExerciseSet has no householdId —
// scope through Exercise → Workout → HealthMember (invariant 2).
export async function listExercisesForWorkout(
  householdId: string,
  workoutId: string
): Promise<Array<WorkoutExerciseRow>> {
  const exercises = await sql<Array<Omit<WorkoutExerciseRow, "sets">>>`
    SELECT e."id", e."workoutId", e."exerciseName", e."orderIndex",
           e."supersetGroupId", e."notes"
    FROM "WorkoutExercise" e
    JOIN "Workout" w ON w."id" = e."workoutId"
    JOIN "HealthMember" m ON m."id" = w."memberId"
    WHERE e."workoutId" = ${workoutId} AND m."householdId" = ${householdId}
    ORDER BY e."orderIndex" ASC`
  const sets = await sql<Array<ExerciseSetRow>>`
    SELECT s."id", s."workoutExerciseId", s."setIndex", s."setType",
           s."weightLbs"::float8, s."reps", s."distanceMiles"::float8,
           s."durationSeconds", s."rpe"::float8
    FROM "ExerciseSet" s
    JOIN "WorkoutExercise" e ON e."id" = s."workoutExerciseId"
    JOIN "Workout" w ON w."id" = e."workoutId"
    JOIN "HealthMember" m ON m."id" = w."memberId"
    WHERE e."workoutId" = ${workoutId} AND m."householdId" = ${householdId}
    ORDER BY s."setIndex" ASC`
  return exercises.map((e) => ({
    ...e,
    sets: sets.filter((s) => s.workoutExerciseId === e.id),
  }))
}

export async function createWorkout(
  memberId: string,
  title: string,
  startTime: Date,
  endTime: Date | null,
  description: string | null
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Workout" ("memberId", "title", "startTime", "endTime", "description")
    VALUES (${memberId}, ${title}, ${startTime}, ${endTime}, ${description})
    RETURNING "id"`
  return rows[0].id
}

export async function deleteWorkout(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Workout" w
    USING "HealthMember" m
    WHERE w."id" = ${id} AND m."id" = w."memberId"
      AND m."householdId" = ${householdId}
    RETURNING w."id"`
  return rows.length > 0
}

// orderIndex = last + 1, computed and ownership-checked in one statement.
export async function addExercise(
  householdId: string,
  workoutId: string,
  exerciseName: string,
  notes: string | null
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "WorkoutExercise" ("workoutId", "exerciseName", "orderIndex", "notes")
    SELECT w."id", ${exerciseName},
           COALESCE((SELECT MAX(e."orderIndex") FROM "WorkoutExercise" e
                     WHERE e."workoutId" = w."id"), -1) + 1,
           ${notes}
    FROM "Workout" w
    JOIN "HealthMember" m ON m."id" = w."memberId"
    WHERE w."id" = ${workoutId} AND m."householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteExercise(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "WorkoutExercise" e
    USING "Workout" w, "HealthMember" m
    WHERE e."id" = ${id} AND w."id" = e."workoutId"
      AND m."id" = w."memberId" AND m."householdId" = ${householdId}
    RETURNING e."id"`
  return rows.length > 0
}

export type ExerciseSetInput = {
  setType: SetType
  weightLbs: number | null
  reps: number | null
  distanceMiles: number | null
  durationSeconds: number | null
  rpe: number | null
}

export async function addSet(
  householdId: string,
  workoutExerciseId: string,
  input: ExerciseSetInput
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "ExerciseSet"
      ("workoutExerciseId", "setIndex", "setType", "weightLbs", "reps",
       "distanceMiles", "durationSeconds", "rpe")
    SELECT e."id",
           COALESCE((SELECT MAX(s."setIndex") FROM "ExerciseSet" s
                     WHERE s."workoutExerciseId" = e."id"), -1) + 1,
           ${input.setType}::"SetType", ${input.weightLbs}, ${input.reps},
           ${input.distanceMiles}, ${input.durationSeconds}, ${input.rpe}
    FROM "WorkoutExercise" e
    JOIN "Workout" w ON w."id" = e."workoutId"
    JOIN "HealthMember" m ON m."id" = w."memberId"
    WHERE e."id" = ${workoutExerciseId} AND m."householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteSet(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "ExerciseSet" s
    USING "WorkoutExercise" e, "Workout" w, "HealthMember" m
    WHERE s."id" = ${id} AND e."id" = s."workoutExerciseId"
      AND w."id" = e."workoutId" AND m."id" = w."memberId"
      AND m."householdId" = ${householdId}
    RETURNING s."id"`
  return rows.length > 0
}

// ─── Stats ──────────────────────────────────────────────
// Faithful port of the legacy stats page: totals, volume = Σ weight×reps,
// avg duration, consecutive-day streak, top exercises, personal records,
// monthly activity (6 months), weekly frequency (12 weeks).

export type TopExerciseRow = {
  name: string
  count: number
  sets: number
  volume: number
  bestWeight: number
}

export type PersonalRecord = {
  name: string
  heaviestWeight: number
  heaviestReps: number
  highestVolume: number
  highestVolumeWeight: number
  highestVolumeReps: number
  mostReps: number
  mostRepsWeight: number
}

export type WorkoutStats = {
  totalWorkouts: number
  totalExercises: number
  totalSets: number
  totalVolume: number
  avgDurationMinutes: number
  streakDays: number
  topExercises: Array<TopExerciseRow>
  personalRecords: Array<PersonalRecord>
  monthly: Array<{
    label: string
    workouts: number
    volume: number
    avgDuration: number
  }>
  weekly: Array<{ label: string; count: number }>
}

function localDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export async function getWorkoutStats(
  householdId: string,
  memberId: string | null
): Promise<WorkoutStats> {
  // Per-workout aggregates (one row per workout, newest first).
  const workouts = await sql<
    Array<{
      id: string
      startTime: Date
      endTime: Date | null
      exerciseCount: number
      setCount: number
      volume: number
    }>
  >`
    SELECT w."id", w."startTime", w."endTime",
           (SELECT COUNT(*)::int FROM "WorkoutExercise" e
             WHERE e."workoutId" = w."id") AS "exerciseCount",
           (SELECT COUNT(*)::int FROM "ExerciseSet" s
             JOIN "WorkoutExercise" e ON e."id" = s."workoutExerciseId"
             WHERE e."workoutId" = w."id") AS "setCount",
           COALESCE((SELECT SUM(COALESCE(s."weightLbs", 0) * COALESCE(s."reps", 0))
             FROM "ExerciseSet" s
             JOIN "WorkoutExercise" e ON e."id" = s."workoutExerciseId"
             WHERE e."workoutId" = w."id"), 0)::float8 AS "volume"
    FROM "Workout" w
    JOIN "HealthMember" m ON m."id" = w."memberId"
    WHERE m."householdId" = ${householdId}
      AND (${memberId}::uuid IS NULL OR w."memberId" = ${memberId}::uuid)
    ORDER BY w."startTime" DESC`

  const totalWorkouts = workouts.length
  const totalExercises = workouts.reduce((s, w) => s + w.exerciseCount, 0)
  const totalSets = workouts.reduce((s, w) => s + w.setCount, 0)
  const totalVolume = workouts.reduce((s, w) => s + w.volume, 0)

  const withDuration = workouts.filter((w) => w.endTime)
  const avgDurationMinutes =
    withDuration.length > 0
      ? Math.round(
          withDuration.reduce(
            (s, w) =>
              s +
              ((w.endTime as Date).getTime() - w.startTime.getTime()) / 60000,
            0
          ) / withDuration.length
        )
      : 0

  // Consecutive-day streak ending today (local dates).
  const workoutDates = [
    ...new Set(workouts.map((w) => localDateStr(w.startTime))),
  ].sort((a, b) => b.localeCompare(a))
  let streakDays = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < workoutDates.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    if (workoutDates[i] === localDateStr(expected)) {
      streakDays++
    } else {
      break
    }
  }

  // Top exercises by times performed.
  const topExercises = await sql<Array<TopExerciseRow>>`
    SELECT e."exerciseName" AS "name",
           COUNT(DISTINCT e."id")::int AS "count",
           COUNT(s."id")::int AS "sets",
           COALESCE(SUM(COALESCE(s."weightLbs", 0) * COALESCE(s."reps", 0)), 0)::float8 AS "volume",
           COALESCE(MAX(s."weightLbs"), 0)::float8 AS "bestWeight"
    FROM "WorkoutExercise" e
    JOIN "Workout" w ON w."id" = e."workoutId"
    JOIN "HealthMember" m ON m."id" = w."memberId"
    LEFT JOIN "ExerciseSet" s ON s."workoutExerciseId" = e."id"
    WHERE m."householdId" = ${householdId}
      AND (${memberId}::uuid IS NULL OR w."memberId" = ${memberId}::uuid)
    GROUP BY e."exerciseName"
    ORDER BY "count" DESC, "name" ASC
    LIMIT 10`

  // Personal records — weighted sets only, newest first so ties keep the
  // most recent set (legacy iteration order).
  const prSets = await sql<
    Array<{ name: string; weight: number; reps: number | null }>
  >`
    SELECT e."exerciseName" AS "name", s."weightLbs"::float8 AS "weight", s."reps"
    FROM "ExerciseSet" s
    JOIN "WorkoutExercise" e ON e."id" = s."workoutExerciseId"
    JOIN "Workout" w ON w."id" = e."workoutId"
    JOIN "HealthMember" m ON m."id" = w."memberId"
    WHERE m."householdId" = ${householdId}
      AND (${memberId}::uuid IS NULL OR w."memberId" = ${memberId}::uuid)
      AND s."weightLbs" > 0
    ORDER BY w."startTime" DESC, e."orderIndex" ASC, s."setIndex" ASC`

  const prMap = new Map<string, PersonalRecord>()
  for (const set of prSets) {
    const reps = set.reps ?? 0
    const entry = prMap.get(set.name) ?? {
      name: set.name,
      heaviestWeight: 0,
      heaviestReps: 0,
      highestVolume: 0,
      highestVolumeWeight: 0,
      highestVolumeReps: 0,
      mostReps: 0,
      mostRepsWeight: 0,
    }
    if (set.weight > entry.heaviestWeight) {
      entry.heaviestWeight = set.weight
      entry.heaviestReps = reps
    }
    const vol = set.weight * reps
    if (vol > entry.highestVolume) {
      entry.highestVolume = vol
      entry.highestVolumeWeight = set.weight
      entry.highestVolumeReps = reps
    }
    if (reps > entry.mostReps) {
      entry.mostReps = reps
      entry.mostRepsWeight = set.weight
    }
    prMap.set(set.name, entry)
  }
  const personalRecords = [...prMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  // Monthly activity (last 6 months).
  const monthly: WorkoutStats["monthly"] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const year = d.getFullYear()
    const month = d.getMonth()
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    })
    const monthWorkouts = workouts.filter(
      (w) =>
        w.startTime.getFullYear() === year && w.startTime.getMonth() === month
    )
    const volume = monthWorkouts.reduce((s, w) => s + w.volume, 0)
    const withDur = monthWorkouts.filter((w) => w.endTime)
    const avgDuration =
      withDur.length > 0
        ? Math.round(
            withDur.reduce(
              (s, w) =>
                s +
                ((w.endTime as Date).getTime() - w.startTime.getTime()) / 60000,
              0
            ) / withDur.length
          )
        : 0
    monthly.push({ label, workouts: monthWorkouts.length, volume, avgDuration })
  }

  // Weekly frequency (last 12 weeks, weeks start Sunday).
  const weekly: WorkoutStats["weekly"] = []
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const count = workouts.filter(
      (w) => w.startTime >= weekStart && w.startTime < weekEnd
    ).length
    weekly.push({
      label: weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count,
    })
  }

  return {
    totalWorkouts,
    totalExercises,
    totalSets,
    totalVolume,
    avgDurationMinutes,
    streakDays,
    topExercises,
    personalRecords,
    monthly,
    weekly,
  }
}
