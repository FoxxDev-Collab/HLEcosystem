import { sql } from "@/server/db"

export type Species =
  | "DOG"
  | "CAT"
  | "BIRD"
  | "FISH"
  | "REPTILE"
  | "SMALL_MAMMAL"
  | "HORSE"
  | "OTHER"

export type PetAppointmentType =
  | "WELLNESS_EXAM"
  | "VACCINATION"
  | "DENTAL"
  | "SURGERY"
  | "EMERGENCY"
  | "GROOMING"
  | "LAB_WORK"
  | "FOLLOW_UP"
  | "OTHER"

export type PetAppointmentStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "RESCHEDULED"

export type PetInsuranceType =
  | "ACCIDENT_ONLY"
  | "ACCIDENT_AND_ILLNESS"
  | "WELLNESS"
  | "COMPREHENSIVE"
  | "OTHER"

export type PetListRow = {
  id: string
  name: string
  species: Species
  breed: string | null
  gender: string | null
  dateOfBirth: string | null
  isActive: boolean
  vaccinationCount: number
  activeMedicationCount: number
  scheduledAppointmentCount: number
  ongoingConditionCount: number
  activeInsuranceCount: number
}

export type PetRow = {
  id: string
  name: string
  species: Species
  breed: string | null
  color: string | null
  weightLbs: number | null
  dateOfBirth: string | null
  gender: string | null
  microchipId: string | null
  adoptionDate: string | null
  notes: string | null
  isActive: boolean
  createdAt: Date
}

export type PetVaccinationRow = {
  id: string
  vaccineName: string
  doseNumber: string | null
  dateAdministered: string
  nextDueDate: string | null
  administeredBy: string | null
  providerId: string | null
  providerName: string | null
  lotNumber: string | null
  notes: string | null
}

export type PetMedicationRow = {
  id: string
  medicationName: string
  dosage: string | null
  frequency: string | null
  startDate: string | null
  endDate: string | null
  isActive: boolean
  prescribedBy: string | null
  pharmacy: string | null
  nextRefillDate: string | null
  purpose: string | null
  costPerRefill: number | null
  notes: string | null
}

export type PetAppointmentRow = {
  id: string
  providerId: string | null
  providerName: string | null
  appointmentDateTime: Date
  durationMinutes: number
  appointmentType: PetAppointmentType
  status: PetAppointmentStatus
  location: string | null
  reasonForVisit: string | null
  diagnosis: string | null
  treatmentNotes: string | null
  cost: number | null
  notes: string | null
}

export type PetConditionRow = {
  id: string
  conditionName: string
  diagnosedDate: string | null
  resolvedDate: string | null
  isOngoing: boolean
  severity: string | null
  treatment: string | null
  notes: string | null
}

export type PetInsuranceRow = {
  id: string
  providerName: string
  policyNumber: string
  insuranceType: PetInsuranceType
  monthlyPremium: number | null
  deductible: number | null
  annualLimit: number | null
  reimbursementPct: number | null
  effectiveDate: string | null
  expirationDate: string | null
  phoneNumber: string | null
  website: string | null
  notes: string | null
  isActive: boolean
}

export type VetProviderRow = {
  id: string
  name: string
}

export async function listPets(
  householdId: string
): Promise<Array<PetListRow>> {
  return sql<Array<PetListRow>>`
    SELECT p."id", p."name", p."species", p."breed", p."gender",
           p."dateOfBirth"::text, p."isActive",
           (SELECT COUNT(*)::int FROM "PetVaccination" v
             WHERE v."petId" = p."id") AS "vaccinationCount",
           (SELECT COUNT(*)::int FROM "PetMedication" m
             WHERE m."petId" = p."id" AND m."isActive") AS "activeMedicationCount",
           (SELECT COUNT(*)::int FROM "PetAppointment" a
             WHERE a."petId" = p."id" AND a."status" = 'SCHEDULED') AS "scheduledAppointmentCount",
           (SELECT COUNT(*)::int FROM "PetCondition" c
             WHERE c."petId" = p."id" AND c."isOngoing") AS "ongoingConditionCount",
           (SELECT COUNT(*)::int FROM "PetInsurance" i
             WHERE i."petId" = p."id" AND i."isActive") AS "activeInsuranceCount"
    FROM "Pet" p
    WHERE p."householdId" = ${householdId}
    ORDER BY p."isActive" DESC, p."name" ASC`
}

export async function getPet(
  householdId: string,
  id: string
): Promise<PetRow | null> {
  const rows = await sql<Array<PetRow>>`
    SELECT "id", "name", "species", "breed", "color", "weightLbs"::float8,
           "dateOfBirth"::text, "gender", "microchipId", "adoptionDate"::text,
           "notes", "isActive", "createdAt"
    FROM "Pet"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return rows[0] ?? null
}

// Ownership re-check before mutating child rows by a client-supplied pet id.
export async function petBelongsToHousehold(
  householdId: string,
  petId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Pet"
    WHERE "id" = ${petId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// Vets = health "Provider" rows of type VETERINARIAN (read-only picker).
export async function listVetProviders(
  householdId: string
): Promise<Array<VetProviderRow>> {
  return sql<Array<VetProviderRow>>`
    SELECT "id", "name"
    FROM "Provider"
    WHERE "householdId" = ${householdId}
      AND "type" = 'VETERINARIAN' AND "isActive"
    ORDER BY "name" ASC`
}

export async function providerBelongsToHousehold(
  householdId: string,
  providerId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Provider"
    WHERE "id" = ${providerId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

// ─── Pet child lists (scoped through Pet → householdId) ──

export async function listPetVaccinations(
  householdId: string,
  petId: string
): Promise<Array<PetVaccinationRow>> {
  return sql<Array<PetVaccinationRow>>`
    SELECT v."id", v."vaccineName", v."doseNumber", v."dateAdministered"::text,
           v."nextDueDate"::text, v."administeredBy", v."providerId",
           pr."name" AS "providerName", v."lotNumber", v."notes"
    FROM "PetVaccination" v
    JOIN "Pet" p ON p."id" = v."petId"
    LEFT JOIN "Provider" pr ON pr."id" = v."providerId"
    WHERE v."petId" = ${petId} AND p."householdId" = ${householdId}
    ORDER BY v."dateAdministered" DESC`
}

export async function listPetMedications(
  householdId: string,
  petId: string
): Promise<Array<PetMedicationRow>> {
  return sql<Array<PetMedicationRow>>`
    SELECT m."id", m."medicationName", m."dosage", m."frequency",
           m."startDate"::text, m."endDate"::text, m."isActive",
           m."prescribedBy", m."pharmacy", m."nextRefillDate"::text,
           m."purpose", m."costPerRefill"::float8, m."notes"
    FROM "PetMedication" m
    JOIN "Pet" p ON p."id" = m."petId"
    WHERE m."petId" = ${petId} AND p."householdId" = ${householdId}
    ORDER BY m."isActive" DESC, m."medicationName" ASC`
}

export async function listPetAppointments(
  householdId: string,
  petId: string
): Promise<Array<PetAppointmentRow>> {
  return sql<Array<PetAppointmentRow>>`
    SELECT a."id", a."providerId", pr."name" AS "providerName",
           a."appointmentDateTime", a."durationMinutes", a."appointmentType",
           a."status", a."location", a."reasonForVisit", a."diagnosis",
           a."treatmentNotes", a."cost"::float8, a."notes"
    FROM "PetAppointment" a
    JOIN "Pet" p ON p."id" = a."petId"
    LEFT JOIN "Provider" pr ON pr."id" = a."providerId"
    WHERE a."petId" = ${petId} AND p."householdId" = ${householdId}
    ORDER BY a."appointmentDateTime" DESC`
}

export async function listPetConditions(
  householdId: string,
  petId: string
): Promise<Array<PetConditionRow>> {
  return sql<Array<PetConditionRow>>`
    SELECT c."id", c."conditionName", c."diagnosedDate"::text,
           c."resolvedDate"::text, c."isOngoing", c."severity", c."treatment",
           c."notes"
    FROM "PetCondition" c
    JOIN "Pet" p ON p."id" = c."petId"
    WHERE c."petId" = ${petId} AND p."householdId" = ${householdId}
    ORDER BY c."isOngoing" DESC, c."conditionName" ASC`
}

export async function listPetInsurances(
  householdId: string,
  petId: string
): Promise<Array<PetInsuranceRow>> {
  return sql<Array<PetInsuranceRow>>`
    SELECT i."id", i."providerName", i."policyNumber", i."insuranceType",
           i."monthlyPremium"::float8, i."deductible"::float8,
           i."annualLimit"::float8, i."reimbursementPct",
           i."effectiveDate"::text, i."expirationDate"::text, i."phoneNumber",
           i."website", i."notes", i."isActive"
    FROM "PetInsurance" i
    JOIN "Pet" p ON p."id" = i."petId"
    WHERE i."petId" = ${petId} AND p."householdId" = ${householdId}
    ORDER BY i."isActive" DESC, i."providerName" ASC`
}

// ─── Pet mutations ──────────────────────────────────────

export type PetInput = {
  name: string
  species: Species
  breed: string | null
  color: string | null
  weightLbs: number | null
  dateOfBirth: string | null
  gender: string | null
  microchipId: string | null
  adoptionDate: string | null
  notes: string | null
}

export async function createPet(
  householdId: string,
  input: PetInput
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Pet" (
      "householdId", "name", "species", "breed", "color", "weightLbs",
      "dateOfBirth", "gender", "microchipId", "adoptionDate", "notes"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.species}::"Species",
      ${input.breed}, ${input.color}, ${input.weightLbs}, ${input.dateOfBirth},
      ${input.gender}, ${input.microchipId}, ${input.adoptionDate},
      ${input.notes}
    ) RETURNING "id"`
  return rows[0].id
}

export async function updatePet(
  householdId: string,
  id: string,
  input: PetInput,
  isActive: boolean
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Pet" SET
      "name" = ${input.name},
      "species" = ${input.species}::"Species",
      "breed" = ${input.breed},
      "color" = ${input.color},
      "weightLbs" = ${input.weightLbs},
      "dateOfBirth" = ${input.dateOfBirth},
      "gender" = ${input.gender},
      "microchipId" = ${input.microchipId},
      "adoptionDate" = ${input.adoptionDate},
      "notes" = ${input.notes},
      "isActive" = ${isActive},
      "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deletePet(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Pet"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

// ─── Vaccinations ───────────────────────────────────────

export type PetVaccinationInput = {
  vaccineName: string
  doseNumber: string | null
  dateAdministered: string
  nextDueDate: string | null
  administeredBy: string | null
  providerId: string | null
  lotNumber: string | null
  notes: string | null
}

export async function createPetVaccination(
  petId: string,
  input: PetVaccinationInput
): Promise<void> {
  await sql`
    INSERT INTO "PetVaccination" (
      "petId", "vaccineName", "doseNumber", "dateAdministered", "nextDueDate",
      "administeredBy", "providerId", "lotNumber", "notes"
    ) VALUES (
      ${petId}, ${input.vaccineName}, ${input.doseNumber},
      ${input.dateAdministered}, ${input.nextDueDate}, ${input.administeredBy},
      ${input.providerId}, ${input.lotNumber}, ${input.notes}
    )`
}

export async function deletePetVaccination(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "PetVaccination" v
    USING "Pet" p
    WHERE v."id" = ${id} AND p."id" = v."petId"
      AND p."householdId" = ${householdId}
    RETURNING v."id"`
  return rows.length > 0
}

// ─── Medications ────────────────────────────────────────

export type PetMedicationInput = {
  medicationName: string
  dosage: string | null
  frequency: string | null
  startDate: string | null
  endDate: string | null
  prescribedBy: string | null
  pharmacy: string | null
  nextRefillDate: string | null
  purpose: string | null
  costPerRefill: number | null
  notes: string | null
}

export async function createPetMedication(
  petId: string,
  input: PetMedicationInput
): Promise<void> {
  await sql`
    INSERT INTO "PetMedication" (
      "petId", "medicationName", "dosage", "frequency", "startDate", "endDate",
      "prescribedBy", "pharmacy", "nextRefillDate", "purpose", "costPerRefill",
      "notes"
    ) VALUES (
      ${petId}, ${input.medicationName}, ${input.dosage}, ${input.frequency},
      ${input.startDate}, ${input.endDate}, ${input.prescribedBy},
      ${input.pharmacy}, ${input.nextRefillDate}, ${input.purpose},
      ${input.costPerRefill}, ${input.notes}
    )`
}

export async function setPetMedicationActive(
  householdId: string,
  id: string,
  isActive: boolean
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "PetMedication" m
    SET "isActive" = ${isActive}, "updatedAt" = now()
    FROM "Pet" p
    WHERE m."id" = ${id} AND p."id" = m."petId"
      AND p."householdId" = ${householdId}
    RETURNING m."id"`
  return rows.length > 0
}

export async function deletePetMedication(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "PetMedication" m
    USING "Pet" p
    WHERE m."id" = ${id} AND p."id" = m."petId"
      AND p."householdId" = ${householdId}
    RETURNING m."id"`
  return rows.length > 0
}

// ─── Appointments ───────────────────────────────────────

export type PetAppointmentInput = {
  providerId: string | null
  appointmentDateTime: Date
  durationMinutes: number
  appointmentType: PetAppointmentType
  location: string | null
  reasonForVisit: string | null
  notes: string | null
}

export async function createPetAppointment(
  petId: string,
  input: PetAppointmentInput
): Promise<void> {
  await sql`
    INSERT INTO "PetAppointment" (
      "petId", "providerId", "appointmentDateTime", "durationMinutes",
      "appointmentType", "location", "reasonForVisit", "notes"
    ) VALUES (
      ${petId}, ${input.providerId}, ${input.appointmentDateTime},
      ${input.durationMinutes}, ${input.appointmentType}::"PetAppointmentType",
      ${input.location}, ${input.reasonForVisit}, ${input.notes}
    )`
}

export async function updatePetAppointmentStatus(
  householdId: string,
  id: string,
  status: PetAppointmentStatus
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "PetAppointment" a
    SET "status" = ${status}::"PetAppointmentStatus", "updatedAt" = now()
    FROM "Pet" p
    WHERE a."id" = ${id} AND p."id" = a."petId"
      AND p."householdId" = ${householdId}
    RETURNING a."id"`
  return rows.length > 0
}

export async function deletePetAppointment(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "PetAppointment" a
    USING "Pet" p
    WHERE a."id" = ${id} AND p."id" = a."petId"
      AND p."householdId" = ${householdId}
    RETURNING a."id"`
  return rows.length > 0
}

// ─── Conditions ─────────────────────────────────────────

export type PetConditionInput = {
  conditionName: string
  diagnosedDate: string | null
  isOngoing: boolean
  severity: string | null
  treatment: string | null
  notes: string | null
}

export async function createPetCondition(
  petId: string,
  input: PetConditionInput
): Promise<void> {
  await sql`
    INSERT INTO "PetCondition" (
      "petId", "conditionName", "diagnosedDate", "isOngoing", "severity",
      "treatment", "notes"
    ) VALUES (
      ${petId}, ${input.conditionName}, ${input.diagnosedDate},
      ${input.isOngoing}, ${input.severity}, ${input.treatment}, ${input.notes}
    )`
}

// Marks a condition resolved as of today (legacy passed today's date from
// the client; CURRENT_DATE is the server-side equivalent).
export async function resolvePetCondition(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "PetCondition" c
    SET "isOngoing" = false, "resolvedDate" = CURRENT_DATE, "updatedAt" = now()
    FROM "Pet" p
    WHERE c."id" = ${id} AND p."id" = c."petId"
      AND p."householdId" = ${householdId}
    RETURNING c."id"`
  return rows.length > 0
}

export async function deletePetCondition(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "PetCondition" c
    USING "Pet" p
    WHERE c."id" = ${id} AND p."id" = c."petId"
      AND p."householdId" = ${householdId}
    RETURNING c."id"`
  return rows.length > 0
}

// ─── Insurance ──────────────────────────────────────────

export type PetInsuranceInput = {
  providerName: string
  policyNumber: string
  insuranceType: PetInsuranceType
  monthlyPremium: number | null
  deductible: number | null
  annualLimit: number | null
  reimbursementPct: number | null
  effectiveDate: string | null
  expirationDate: string | null
  phoneNumber: string | null
  website: string | null
  notes: string | null
}

export async function createPetInsurance(
  petId: string,
  input: PetInsuranceInput
): Promise<void> {
  await sql`
    INSERT INTO "PetInsurance" (
      "petId", "providerName", "policyNumber", "insuranceType",
      "monthlyPremium", "deductible", "annualLimit", "reimbursementPct",
      "effectiveDate", "expirationDate", "phoneNumber", "website", "notes"
    ) VALUES (
      ${petId}, ${input.providerName}, ${input.policyNumber},
      ${input.insuranceType}::"PetInsuranceType", ${input.monthlyPremium},
      ${input.deductible}, ${input.annualLimit}, ${input.reimbursementPct},
      ${input.effectiveDate}, ${input.expirationDate}, ${input.phoneNumber},
      ${input.website}, ${input.notes}
    )`
}

export async function deletePetInsurance(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "PetInsurance" i
    USING "Pet" p
    WHERE i."id" = ${id} AND p."id" = i."petId"
      AND p."householdId" = ${householdId}
    RETURNING i."id"`
  return rows.length > 0
}
