import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createPet,
  createPetAppointment,
  createPetCondition,
  createPetInsurance,
  createPetMedication,
  createPetVaccination,
  deletePet,
  deletePetAppointment,
  deletePetCondition,
  deletePetInsurance,
  deletePetMedication,
  deletePetVaccination,
  getPet,
  listPetAppointments,
  listPetConditions,
  listPetInsurances,
  listPetMedications,
  listPetVaccinations,
  listPets,
  listVetProviders,
  petBelongsToHousehold,
  providerBelongsToHousehold,
  resolvePetCondition,
  setPetMedicationActive,
  updatePet,
  updatePetAppointmentStatus,
} from "./pets"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const idSchema = z.object({ id: z.string().min(1) })

const speciesEnum = z.enum([
  "DOG",
  "CAT",
  "BIRD",
  "FISH",
  "REPTILE",
  "SMALL_MAMMAL",
  "HORSE",
  "OTHER",
])

// ─── Pets list page ─────────────────────────────────────

export const getPetsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listPets(context.householdId))

// ─── Pet detail page ────────────────────────────────────

export const getPetFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    const pet = await getPet(context.householdId, data.id)
    if (!pet) return null
    const [
      vaccinations,
      medications,
      appointments,
      conditions,
      insurances,
      vetProviders,
    ] = await Promise.all([
      listPetVaccinations(context.householdId, pet.id),
      listPetMedications(context.householdId, pet.id),
      listPetAppointments(context.householdId, pet.id),
      listPetConditions(context.householdId, pet.id),
      listPetInsurances(context.householdId, pet.id),
      listVetProviders(context.householdId),
    ])
    return {
      pet,
      vaccinations,
      medications,
      appointments,
      conditions,
      insurances,
      vetProviders,
    }
  })

// ─── Pet mutations ──────────────────────────────────────

const petSchema = z.object({
  name: z.string().trim().min(1).max(120),
  species: speciesEnum,
  breed: optText,
  color: optText,
  weightLbs: z.number().min(0).max(10000).nullable(),
  dateOfBirth: optDate,
  gender: optText,
  microchipId: optText,
  adoptionDate: optDate,
  notes: optText,
})

export const createPetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => petSchema.parse(d))
  .handler(async ({ data, context }) => {
    const id = await createPet(context.householdId, data)
    return { ok: true as const, id }
  })

export const updatePetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    petSchema.extend({ id: z.string().min(1), isActive: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { id, isActive, ...input } = data
    const updated = await updatePet(context.householdId, id, input, isActive)
    if (!updated) return { error: "Pet not found." }
    return { ok: true as const }
  })

export const deletePetFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePet(context.householdId, data.id)
    if (!deleted) return { error: "Pet not found." }
    return { ok: true as const }
  })

// Re-verify both the pet and (when set) the provider belong to the household
// before inserting child rows referencing them (ADR-0005).
async function verifyPetAndProvider(
  householdId: string,
  petId: string,
  providerId: string | null
): Promise<string | null> {
  const owned = await petBelongsToHousehold(householdId, petId)
  if (!owned) return "Pet not found."
  if (providerId) {
    const providerOwned = await providerBelongsToHousehold(
      householdId,
      providerId
    )
    if (!providerOwned) return "Provider not found."
  }
  return null
}

// ─── Vaccinations ───────────────────────────────────────

const vaccinationSchema = z.object({
  petId: z.string().min(1),
  vaccineName: z.string().trim().min(1).max(200),
  doseNumber: optText,
  dateAdministered: dateStr,
  nextDueDate: optDate,
  administeredBy: optText,
  providerId: z
    .string()
    .max(64)
    .transform((v) => v.trim() || null),
  lotNumber: optText,
  notes: optText,
})

export const addPetVaccinationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => vaccinationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { petId, ...input } = data
    const error = await verifyPetAndProvider(
      context.householdId,
      petId,
      input.providerId
    )
    if (error) return { error }
    await createPetVaccination(petId, input)
    return { ok: true as const }
  })

export const deletePetVaccinationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePetVaccination(context.householdId, data.id)
    if (!deleted) return { error: "Vaccination not found." }
    return { ok: true as const }
  })

// ─── Medications ────────────────────────────────────────

const medicationSchema = z.object({
  petId: z.string().min(1),
  medicationName: z.string().trim().min(1).max(200),
  dosage: optText,
  frequency: optText,
  startDate: optDate,
  endDate: optDate,
  prescribedBy: optText,
  pharmacy: optText,
  nextRefillDate: optDate,
  purpose: optText,
  costPerRefill: z.number().min(0).max(1000000).nullable(),
  notes: optText,
})

export const addPetMedicationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => medicationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { petId, ...input } = data
    const owned = await petBelongsToHousehold(context.householdId, petId)
    if (!owned) return { error: "Pet not found." }
    await createPetMedication(petId, input)
    return { ok: true as const }
  })

export const deactivatePetMedicationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const updated = await setPetMedicationActive(
      context.householdId,
      data.id,
      false
    )
    if (!updated) return { error: "Medication not found." }
    return { ok: true as const }
  })

export const deletePetMedicationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePetMedication(context.householdId, data.id)
    if (!deleted) return { error: "Medication not found." }
    return { ok: true as const }
  })

// ─── Appointments ───────────────────────────────────────

const appointmentSchema = z.object({
  petId: z.string().min(1),
  appointmentDateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
  durationMinutes: z.number().int().min(1).max(1440),
  appointmentType: z.enum([
    "WELLNESS_EXAM",
    "VACCINATION",
    "DENTAL",
    "SURGERY",
    "EMERGENCY",
    "GROOMING",
    "LAB_WORK",
    "FOLLOW_UP",
    "OTHER",
  ]),
  providerId: z
    .string()
    .max(64)
    .transform((v) => v.trim() || null),
  location: optText,
  reasonForVisit: optText,
  notes: optText,
})

export const addPetAppointmentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => appointmentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { petId, appointmentDateTime, ...input } = data
    const error = await verifyPetAndProvider(
      context.householdId,
      petId,
      input.providerId
    )
    if (error) return { error }
    const when = new Date(appointmentDateTime)
    if (isNaN(when.getTime())) return { error: "Invalid date/time." }
    await createPetAppointment(petId, {
      ...input,
      appointmentDateTime: when,
    })
    return { ok: true as const }
  })

export const setPetAppointmentStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        status: z.enum([
          "SCHEDULED",
          "COMPLETED",
          "CANCELLED",
          "NO_SHOW",
          "RESCHEDULED",
        ]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await updatePetAppointmentStatus(
      context.householdId,
      data.id,
      data.status
    )
    if (!updated) return { error: "Appointment not found." }
    return { ok: true as const }
  })

export const deletePetAppointmentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePetAppointment(context.householdId, data.id)
    if (!deleted) return { error: "Appointment not found." }
    return { ok: true as const }
  })

// ─── Conditions ─────────────────────────────────────────

const conditionSchema = z.object({
  petId: z.string().min(1),
  conditionName: z.string().trim().min(1).max(200),
  diagnosedDate: optDate,
  isOngoing: z.boolean(),
  severity: optText,
  treatment: optText,
  notes: optText,
})

export const addPetConditionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => conditionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { petId, ...input } = data
    const owned = await petBelongsToHousehold(context.householdId, petId)
    if (!owned) return { error: "Pet not found." }
    await createPetCondition(petId, input)
    return { ok: true as const }
  })

export const resolvePetConditionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const updated = await resolvePetCondition(context.householdId, data.id)
    if (!updated) return { error: "Condition not found." }
    return { ok: true as const }
  })

export const deletePetConditionFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePetCondition(context.householdId, data.id)
    if (!deleted) return { error: "Condition not found." }
    return { ok: true as const }
  })

// ─── Insurance ──────────────────────────────────────────

const insuranceSchema = z.object({
  petId: z.string().min(1),
  providerName: z.string().trim().min(1).max(200),
  policyNumber: z.string().trim().min(1).max(120),
  insuranceType: z.enum([
    "ACCIDENT_ONLY",
    "ACCIDENT_AND_ILLNESS",
    "WELLNESS",
    "COMPREHENSIVE",
    "OTHER",
  ]),
  monthlyPremium: z.number().min(0).max(1000000).nullable(),
  deductible: z.number().min(0).max(10000000).nullable(),
  annualLimit: z.number().min(0).max(100000000).nullable(),
  reimbursementPct: z.number().int().min(0).max(100).nullable(),
  effectiveDate: optDate,
  expirationDate: optDate,
  phoneNumber: optText,
  website: optText,
  notes: optText,
})

export const addPetInsuranceFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => insuranceSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { petId, ...input } = data
    const owned = await petBelongsToHousehold(context.householdId, petId)
    if (!owned) return { error: "Pet not found." }
    await createPetInsurance(petId, input)
    return { ok: true as const }
  })

export const deletePetInsuranceFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePetInsurance(context.householdId, data.id)
    if (!deleted) return { error: "Insurance policy not found." }
    return { ok: true as const }
  })
