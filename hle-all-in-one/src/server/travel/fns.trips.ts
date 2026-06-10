import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createTrip,
  deleteTrip,
  listTrips,
  syncTripStatuses,
  updateTrip,
  updateTripStatus,
} from "./trips"

const statusSchema = z.enum([
  "PLANNING",
  "BOOKED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
])

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date" })

const idSchema = z.object({ id: z.string().min(1) })

const tripFields = {
  name: z.string().trim().min(1).max(200),
  destination: optText,
  startDate: dateStr,
  endDate: dateStr,
  description: optText,
  notes: optText,
}

const createTripSchema = z.object(tripFields)
const updateTripSchema = z.object({ tripId: z.string().min(1), ...tripFields })

// ─── Trips list page ────────────────────────────────────

export const listTripsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ status: statusSchema.nullable() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // Legacy dashboard ran this on every visit — statuses roll forward by date.
    await syncTripStatuses(context.householdId)
    return listTrips(context.householdId, data.status)
  })

// ─── Trip mutations ─────────────────────────────────────

export const createTripFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => createTripSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.endDate < data.startDate) {
      return { error: "End date must be after start date." }
    }
    const id = await createTrip(context.householdId, data)
    return { ok: true as const, id }
  })

export const updateTripFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => updateTripSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.endDate < data.startDate) {
      return { error: "End date must be after start date." }
    }
    const { tripId, ...input } = data
    const updated = await updateTrip(context.householdId, tripId, input)
    if (!updated) return { error: "Trip not found." }
    return { ok: true as const }
  })

export const updateTripStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ tripId: z.string().min(1), status: statusSchema }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await updateTripStatus(
      context.householdId,
      data.tripId,
      data.status
    )
    if (!updated) return { error: "Trip not found." }
    return { ok: true as const }
  })

export const deleteTripFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteTrip(context.householdId, data.id)
    if (!deleted) return { error: "Trip not found." }
    return { ok: true as const }
  })
