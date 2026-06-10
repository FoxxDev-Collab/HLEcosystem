// Medical providers (doctors, dentists, labs, pharmacies, vets...).
// Household-scoped directly. VETERINARIAN stays a supported type — the pet
// health pages filter providers down to vets for their own pickers.
import { sql } from "@/server/db"

export type ProviderType =
  | "DOCTOR"
  | "DENTIST"
  | "OPTOMETRIST"
  | "SPECIALIST"
  | "HOSPITAL"
  | "LAB"
  | "PHARMACY"
  | "THERAPIST"
  | "CHIROPRACTOR"
  | "VETERINARIAN"
  | "OTHER"

export type ProviderRow = {
  id: string
  name: string
  specialty: string | null
  type: ProviderType
  address: string | null
  phoneNumber: string | null
  email: string | null
  website: string | null
  portalUrl: string | null
  notes: string | null
  isActive: boolean
}

export type ProviderOption = {
  id: string
  name: string
}

export type ProviderInput = {
  name: string
  type: ProviderType
  specialty: string | null
  phoneNumber: string | null
  address: string | null
  email: string | null
  website: string | null
  portalUrl: string | null
  notes: string | null
}

export async function listProviders(
  householdId: string
): Promise<Array<ProviderRow>> {
  return sql<Array<ProviderRow>>`
    SELECT "id", "name", "specialty", "type"::text AS "type", "address",
           "phoneNumber", "email", "website", "portalUrl", "notes", "isActive"
    FROM "Provider"
    WHERE "householdId" = ${householdId}
    ORDER BY "isActive" DESC, "type" ASC, "name" ASC`
}

export async function listActiveProviderOptions(
  householdId: string
): Promise<Array<ProviderOption>> {
  return sql<Array<ProviderOption>>`
    SELECT "id", "name"
    FROM "Provider"
    WHERE "householdId" = ${householdId} AND "isActive"
    ORDER BY "name" ASC`
}

// Ownership re-check before linking client-supplied provider ids (ADR-0005).
export async function providerBelongsToHousehold(
  householdId: string,
  providerId: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Provider"
    WHERE "id" = ${providerId} AND "householdId" = ${householdId}`
  return rows.length > 0
}

export async function createProvider(
  householdId: string,
  input: ProviderInput
): Promise<void> {
  await sql`
    INSERT INTO "Provider" (
      "householdId", "name", "type", "specialty", "phoneNumber", "address",
      "email", "website", "portalUrl", "notes"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.type}::"ProviderType",
      ${input.specialty}, ${input.phoneNumber}, ${input.address},
      ${input.email}, ${input.website}, ${input.portalUrl}, ${input.notes}
    )`
}

export async function toggleProviderActive(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "Provider"
    SET "isActive" = NOT "isActive", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}

export async function deleteProvider(
  householdId: string,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "Provider"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
    RETURNING "id"`
  return rows.length > 0
}
