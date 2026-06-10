import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  addSupply,
  createDocumentLocation,
  createEmergencyContact,
  createEmergencyPlan,
  createSupplyKit,
  createUtilityShutoff,
  deleteDocumentLocation,
  deleteEmergencyContact,
  deleteEmergencyPlan,
  deleteSupply,
  deleteSupplyKit,
  deleteUtilityShutoff,
  getEmergencyCounts,
  getEmergencyPlan,
  kitBelongsToHousehold,
  listDocumentLocations,
  listEmergencyContacts,
  listEmergencyPlans,
  listExpiringSupplies,
  listPlansNeedingReview,
  listRoomOptions,
  listSuppliesForHousehold,
  listSupplyKits,
  listUtilityShutoffs,
  markKitChecked,
  markPlanReviewed,
  updateEmergencyPlan,
} from "./emergency"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Empty form fields mean NULL.
const optText = z
  .string()
  .max(5000)
  .transform((v) => v.trim() || null)

const optDate = z
  .string()
  .max(10)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  })

const optId = z.string().transform((v) => v || null)

const idSchema = z.object({ id: z.string().min(1) })

const contactTypeSchema = z.enum([
  "NEIGHBOR",
  "UTILITY",
  "LOCAL_SERVICE",
  "INSURANCE",
  "GOVERNMENT",
  "VETERINARIAN",
  "OTHER",
])

const planTypeSchema = z.enum([
  "FIRE",
  "FLOOD",
  "EARTHQUAKE",
  "TORNADO",
  "HURRICANE",
  "POWER_OUTAGE",
  "MEDICAL",
  "INTRUDER",
  "EVACUATION",
  "CUSTOM",
])

const conditionSchema = z.enum(["GOOD", "LOW", "EXPIRED", "NEEDS_REPLACEMENT"])

// ─── Overview page ──────────────────────────────────────────

export const getEmergencyOverviewFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [counts, expiringSupplies, plansNeedingReview] = await Promise.all([
      getEmergencyCounts(context.householdId),
      listExpiringSupplies(context.householdId),
      listPlansNeedingReview(context.householdId),
    ])
    return { counts, expiringSupplies, plansNeedingReview }
  })

// ─── Contacts ───────────────────────────────────────────────

export const getEmergencyContactsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listEmergencyContacts(context.householdId))

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: contactTypeSchema,
  company: optText,
  phone: optText,
  phoneAlt: optText,
  email: optText,
  address: optText,
  accountNumber: optText,
  availableHours: optText,
  priority: z.number().int().min(0).max(10),
  notes: optText,
})

export const createEmergencyContactFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createEmergencyContact(context.householdId, data)
    return { ok: true as const }
  })

export const deleteEmergencyContactFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteEmergencyContact(context.householdId, data.id)
    if (!deleted) return { error: "Contact not found." }
    return { ok: true as const }
  })

// ─── Plans ──────────────────────────────────────────────────

export const getEmergencyPlansFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listEmergencyPlans(context.householdId))

export const getEmergencyPlanFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    return getEmergencyPlan(context.householdId, data.id)
  })

const planSchema = z.object({
  type: planTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: optText,
  meetingPoint: optText,
  evacuationRoute: optText,
  procedures: optText,
  reviewFrequencyMonths: z.number().int().min(1).nullable(),
  notes: optText,
})

export const createEmergencyPlanFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createEmergencyPlan(context.householdId, data)
    return { ok: true as const }
  })

export const updateEmergencyPlanFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    planSchema.extend({ id: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    const updated = await updateEmergencyPlan(context.householdId, id, input)
    if (!updated) return { error: "Plan not found." }
    return { ok: true as const }
  })

export const deleteEmergencyPlanFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteEmergencyPlan(context.householdId, data.id)
    if (!deleted) return { error: "Plan not found." }
    return { ok: true as const }
  })

export const markPlanReviewedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const updated = await markPlanReviewed(context.householdId, data.id)
    if (!updated) return { error: "Plan not found." }
    return { ok: true as const }
  })

// ─── Supply kits ────────────────────────────────────────────

export const getSuppliesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [kits, supplies, rooms] = await Promise.all([
      listSupplyKits(context.householdId),
      listSuppliesForHousehold(context.householdId),
      listRoomOptions(context.householdId),
    ])
    return { kits, supplies, rooms }
  })

const kitSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: optText,
  roomId: optId,
  description: optText,
  notes: optText,
})

export const createSupplyKitFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => kitSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createSupplyKit(context.householdId, data)
    return { ok: true as const }
  })

export const deleteSupplyKitFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteSupplyKit(context.householdId, data.id)
    if (!deleted) return { error: "Kit not found." }
    return { ok: true as const }
  })

export const markKitCheckedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const updated = await markKitChecked(context.householdId, data.id)
    if (!updated) return { error: "Kit not found." }
    return { ok: true as const }
  })

const supplySchema = z.object({
  kitId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1),
  unit: optText,
  expirationDate: optDate,
  condition: conditionSchema,
  notes: optText,
})

export const addSupplyItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => supplySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { kitId, ...input } = data
    const owned = await kitBelongsToHousehold(context.householdId, kitId)
    if (!owned) return { error: "Kit not found." }
    await addSupply(kitId, input)
    return { ok: true as const }
  })

export const deleteSupplyItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteSupply(context.householdId, data.id)
    if (!deleted) return { error: "Supply item not found." }
    return { ok: true as const }
  })

// ─── Utility shutoffs ───────────────────────────────────────

export const getUtilitiesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [shutoffs, rooms] = await Promise.all([
      listUtilityShutoffs(context.householdId),
      listRoomOptions(context.householdId),
    ])
    return { shutoffs, rooms }
  })

const shutoffSchema = z.object({
  utilityType: z.string().trim().min(1).max(100),
  location: z.string().trim().min(1).max(300),
  roomId: optId,
  procedure: optText,
  toolsNeeded: optText,
  notes: optText,
})

export const createUtilityShutoffFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => shutoffSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createUtilityShutoff(context.householdId, data)
    return { ok: true as const }
  })

export const deleteUtilityShutoffFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteUtilityShutoff(context.householdId, data.id)
    if (!deleted) return { error: "Shutoff location not found." }
    return { ok: true as const }
  })

// ─── Important document locations ───────────────────────────

export const getEmergencyDocumentsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listDocumentLocations(context.householdId))

const documentLocationSchema = z.object({
  documentName: z.string().trim().min(1).max(200),
  category: optText,
  physicalLocation: optText,
  digitalLocation: optText,
  accountNumber: optText,
  policyNumber: optText,
  expirationDate: optDate,
  notes: optText,
})

export const createDocumentLocationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => documentLocationSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createDocumentLocation(context.householdId, data)
    return { ok: true as const }
  })

export const deleteDocumentLocationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteDocumentLocation(context.householdId, data.id)
    if (!deleted) return { error: "Document not found." }
    return { ok: true as const }
  })
