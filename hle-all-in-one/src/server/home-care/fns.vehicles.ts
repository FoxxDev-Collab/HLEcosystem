import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listDocumentsForVehicle,
  listMaintenanceLogsForVehicle,
  listRepairsForVehicle,
  listVehicles,
  updateVehicle,
} from "./vehicles"
import { listMileageEntriesForVehicle } from "./mileage"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const optDate = z
  .string()
  .max(10)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  })

const optInt = z
  .string()
  .max(12)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d+$/.test(v), { message: "Invalid number" })
  .transform((v) => (v === null ? null : parseInt(v, 10)))

const optMoney = z
  .string()
  .max(20)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Invalid amount",
  })
  .transform((v) => (v === null ? null : parseFloat(v)))

const vehicleSchema = z.object({
  year: optInt,
  make: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  trim: optText,
  vin: optText,
  licensePlate: optText,
  color: optText,
  currentMileage: optInt,
  purchaseDate: optDate,
  purchasePrice: optMoney,
  purchasedFrom: optText,
  notes: optText,
})

const idSchema = z.object({ id: z.string().min(1) })

// ─── Vehicles list page ──────────────────────────────────

export const getVehiclesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listVehicles(context.householdId))

// ─── Vehicle detail page ─────────────────────────────────

export const getVehicleFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const vehicle = await getVehicle(context.householdId, data.id)
    if (!vehicle) return null
    const [mileageEntries, maintenanceLogs, repairs, documents] =
      await Promise.all([
        listMileageEntriesForVehicle(context.householdId, vehicle.id),
        listMaintenanceLogsForVehicle(context.householdId, vehicle.id),
        listRepairsForVehicle(context.householdId, vehicle.id),
        listDocumentsForVehicle(context.householdId, vehicle.id),
      ])
    return { vehicle, mileageEntries, maintenanceLogs, repairs, documents }
  })

// ─── Mutations ───────────────────────────────────────────

export const createVehicleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => vehicleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const id = await createVehicle(context.householdId, data)
    return { ok: true as const, id }
  })

export const updateVehicleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    vehicleSchema
      .extend({
        id: z.string().min(1),
        status: z.enum(["ACTIVE", "SOLD", "SCRAPPED", "STORED"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, status, ...input } = data
    const updated = await updateVehicle(context.householdId, id, input, status)
    if (!updated) return { error: "Vehicle not found." }
    return { ok: true as const }
  })

export const deleteVehicleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteVehicle(context.householdId, data.id)
    if (!deleted) return { error: "Vehicle not found." }
    return { ok: true as const }
  })
