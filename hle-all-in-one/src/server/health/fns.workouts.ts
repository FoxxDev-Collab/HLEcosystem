import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  addExercise,
  addSet,
  createWorkout,
  deleteExercise,
  deleteSet,
  deleteWorkout,
  getWorkout,
  getWorkoutStats,
  healthMemberBelongsToHousehold,
  listExercisesForWorkout,
  listHealthMembers,
  listWorkouts,
} from "./workouts"
import { importParsedWorkouts, parseWorkoutCsv } from "./workouts-import"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const idSchema = z.object({ id: z.string().min(1) })

const memberFilterSchema = z.object({
  memberId: z.string().max(64).nullable(),
})

// ─── Workouts list page ─────────────────────────────────

export const getWorkoutsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => memberFilterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const memberId =
      data.memberId && UUID_RE.test(data.memberId) ? data.memberId : null
    const [members, workouts] = await Promise.all([
      listHealthMembers(context.householdId),
      listWorkouts(context.householdId, memberId),
    ])
    return { members, workouts, memberId }
  })

// ─── Workout detail page ────────────────────────────────

export const getWorkoutFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const workout = await getWorkout(context.householdId, data.id)
    if (!workout) return null
    const exercises = await listExercisesForWorkout(
      context.householdId,
      workout.id
    )
    return { workout, exercises }
  })

// ─── Stats page ─────────────────────────────────────────

export const getWorkoutStatsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => memberFilterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const memberId =
      data.memberId && UUID_RE.test(data.memberId) ? data.memberId : null
    const [members, stats] = await Promise.all([
      listHealthMembers(context.householdId),
      getWorkoutStats(context.householdId, memberId),
    ])
    return { members, stats, memberId }
  })

// ─── Import page ────────────────────────────────────────

export const getHealthMembersFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listHealthMembers(context.householdId))

// ─── Workout mutations ──────────────────────────────────

const createWorkoutSchema = z.object({
  memberId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  description: optText,
})

export const createWorkoutFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => createWorkoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      data.memberId
    )
    if (!owned) return { error: "Member not found." }
    const start = new Date(`${data.date}T${data.startTime}:00`)
    if (isNaN(start.getTime())) return { error: "Invalid date or time." }
    const id = await createWorkout(
      data.memberId,
      data.title,
      start,
      null,
      data.description
    )
    return { ok: true as const, id }
  })

export const deleteWorkoutFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteWorkout(context.householdId, data.id)
    if (!deleted) return { error: "Workout not found." }
    return { ok: true as const }
  })

// ─── Exercise mutations ─────────────────────────────────

const addExerciseSchema = z.object({
  workoutId: z.string().min(1),
  exerciseName: z.string().trim().min(1).max(200),
  notes: optText,
})

export const addExerciseFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => addExerciseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const added = await addExercise(
      context.householdId,
      data.workoutId,
      data.exerciseName,
      data.notes
    )
    if (!added) return { error: "Workout not found." }
    return { ok: true as const }
  })

export const deleteExerciseFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteExercise(context.householdId, data.id)
    if (!deleted) return { error: "Exercise not found." }
    return { ok: true as const }
  })

// ─── Set mutations ──────────────────────────────────────

const addSetSchema = z.object({
  workoutExerciseId: z.string().min(1),
  setType: z.enum(["NORMAL", "WARMUP", "FAILURE", "DROPSET"]),
  weightLbs: z.number().min(0).max(10000).nullable(),
  reps: z.number().int().min(0).max(10000).nullable(),
  distanceMiles: z.number().min(0).max(10000).nullable(),
  durationSeconds: z.number().int().min(0).max(1000000).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
})

export const addSetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => addSetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { workoutExerciseId, ...input } = data
    const added = await addSet(context.householdId, workoutExerciseId, input)
    if (!added) return { error: "Exercise not found." }
    return { ok: true as const }
  })

export const deleteSetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteSet(context.householdId, data.id)
    if (!deleted) return { error: "Set not found." }
    return { ok: true as const }
  })

// ─── CSV import ─────────────────────────────────────────

// 5MB bound on the raw CSV string (a Strong export is typically well under
// 1MB) — parsing happens server-side only.
const parseCsvSchema = z.object({
  csv: z
    .string()
    .min(1)
    .max(5 * 1024 * 1024),
})

export const parseWorkoutCsvFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => parseCsvSchema.parse(d))
  .handler(async ({ data }) => parseWorkoutCsv(data.csv))

const parsedSetSchema = z.object({
  setIndex: z.number().int().min(0).max(100000),
  setType: z.enum(["NORMAL", "WARMUP", "FAILURE", "DROPSET"]),
  weightLbs: z.number().nullable(),
  reps: z.number().int().nullable(),
  distanceMiles: z.number().nullable(),
  durationSeconds: z.number().int().nullable(),
  rpe: z.number().nullable(),
})

const parsedExerciseSchema = z.object({
  name: z.string().min(1).max(300),
  notes: z.string().max(2000),
  supersetId: z.number().int().nullable(),
  sets: z.array(parsedSetSchema).max(1000),
})

const parsedWorkoutSchema = z.object({
  date: z.string().max(60),
  title: z.string().min(1).max(300),
  startTime: z.string().max(60),
  endTime: z.string().max(60),
  description: z.string().max(2000),
  exercises: z.array(parsedExerciseSchema).max(300),
})

const importSchema = z.object({
  memberId: z.string().min(1),
  workouts: z.array(parsedWorkoutSchema).min(1).max(2000),
})

export const importWorkoutsFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => importSchema.parse(d))
  .handler(async ({ data, context }) => {
    const owned = await healthMemberBelongsToHousehold(
      context.householdId,
      data.memberId
    )
    if (!owned) return { error: "Member not found." }
    const imported = await importParsedWorkouts(data.memberId, data.workouts)
    return { ok: true as const, imported }
  })
